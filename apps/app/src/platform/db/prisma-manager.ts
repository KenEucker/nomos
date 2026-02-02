/**
 * Prisma manager: singleton that merges schema, runs prisma generate,
 * syncs DB, and reloads the Prisma client at runtime when plugins are enabled/disabled.
 *
 * Critical: After prisma generate, the generated code at node_modules/.prisma/client
 * is new. Node caches require(), so we must clear the cache and re-require to get
 * the fresh client. Without this, the process keeps using the old client.
 */

import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { mergeSchemas } from "./schema/schema-merger.js";

const require = createRequire(import.meta.url);

export type PrismaManagerOptions = {
  /** App root (directory containing prisma/). Defaults to process.cwd(). */
  appRoot?: string;
  /** Path to core schema (prisma/core-schema.prisma). */
  coreSchemaPath?: string;
  /** Path to merged schema output (prisma/schema.prisma). */
  outputSchemaPath?: string;
  /** Plugins directory (e.g. src/plugins). */
  pluginsDir?: string;
  /** DB sync strategy: "push" (db push --skip-generate) or "migrate" (migrate deploy). */
  dbStrategy?: "push" | "migrate";
};

let instance: PrismaManager | null = null;

export class PrismaManager {
  private prismaClient: unknown = null;
  private readonly appRoot: string;
  private readonly coreSchemaPath: string;
  private readonly outputSchemaPath: string;
  private readonly pluginsDir: string;
  private readonly dbStrategy: "push" | "migrate";

  private constructor(options: PrismaManagerOptions = {}) {
    this.appRoot = options.appRoot ?? process.cwd();
    this.coreSchemaPath =
      options.coreSchemaPath ?? path.join(this.appRoot, "prisma", "core-schema.prisma");
    this.outputSchemaPath =
      options.outputSchemaPath ?? path.join(this.appRoot, "prisma", "schema.prisma");
    this.pluginsDir = options.pluginsDir ?? path.join(this.appRoot, "src", "plugins");
    const envStrategy = process.env.NOMOS_DB_STRATEGY as string | undefined;
    this.dbStrategy =
      options.dbStrategy ?? (envStrategy === "migrate" ? "migrate" : "push");
  }

  static getInstance(options?: PrismaManagerOptions): PrismaManager {
    if (!instance) instance = new PrismaManager(options);
    return instance;
  }

  /**
   * Bootstrap the client from the current schema.prisma on disk (no merge, no write).
   * Use at boot so we can read plugin state before merging; avoids ever running
   * db push with core-only schema (which would drop plugin-added columns and data).
   */
  async bootstrapFromCurrentSchema(): Promise<void> {
    if (!fs.existsSync(this.outputSchemaPath)) {
      throw new Error(
        `[PrismaManager] Schema not found: ${this.outputSchemaPath}. Ensure it exists (e.g. copy from core-schema.prisma).`
      );
    }
    execSync("npx prisma generate", {
      cwd: this.appRoot,
      stdio: "inherit",
    });
    await this.reloadClient();
  }

  /**
   * Merge schema (core + enabled plugins), run prisma generate, sync DB, reload client.
   * Throws on merge/generate/sync failure; does not call reloadClient if generate or sync fails.
   * When getPluginSchemaContent is provided, it is used to resolve schema for each plugin
   * (file or converted manifest.database); otherwise only schema.prisma files are read from disk.
   */
  async updateSchema(
    enabledPlugins: string[],
    getPluginSchemaContent?: (slug: string) => string | null
  ): Promise<void> {
    if (!fs.existsSync(this.coreSchemaPath)) {
      throw new Error(
        `[PrismaManager] Core schema not found: ${this.coreSchemaPath}. Create it from the current schema.prisma.`
      );
    }

    // Only write when content changed so file watchers (e.g. tsx watch) don't restart in a loop
    const didWrite = await mergeSchemas(enabledPlugins, {
      corePath: this.coreSchemaPath,
      pluginsDir: this.pluginsDir,
      outputPath: this.outputSchemaPath,
      getPluginSchemaContent,
    });

    if (didWrite) {
      execSync("npx prisma generate", {
        cwd: this.appRoot,
        stdio: "inherit",
      });

      if (this.dbStrategy === "migrate") {
        execSync("npx prisma migrate deploy", {
          cwd: this.appRoot,
          stdio: "inherit",
        });
      } else {
      execSync("npx prisma db push --accept-data-loss", {
          cwd: this.appRoot,
          stdio: "inherit",
        });
      }
    }

    await this.reloadClient();
  }

  /**
   * Disconnect current client, clear require cache for @prisma/client,
   * re-require the module, create new client, connect.
   */
  async reloadClient(): Promise<void> {
    if (this.prismaClient && typeof (this.prismaClient as { $disconnect?: () => Promise<unknown> }).$disconnect === "function") {
      await (this.prismaClient as { $disconnect: () => Promise<unknown> }).$disconnect();
    }
    this.prismaClient = null;

    for (const key of Object.keys(require.cache)) {
      if (key.includes("@prisma/client") || key.includes(".prisma")) {
        delete require.cache[key];
      }
    }

    const { PrismaClient } = require("@prisma/client") as { PrismaClient: new (opts?: unknown) => unknown };
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("[PrismaManager] DATABASE_URL is required for reloadClient.");
    }

    if (databaseUrl.startsWith("file:")) {
      const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3") as {
        PrismaBetterSqlite3: new (opts: { url: string }) => unknown;
      };
      const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
      this.prismaClient = new PrismaClient({ adapter });
    } else {
      this.prismaClient = new PrismaClient();
    }

    if (typeof (this.prismaClient as { $connect?: () => Promise<unknown> }).$connect === "function") {
      await (this.prismaClient as { $connect: () => Promise<unknown> }).$connect();
    }
  }

  /** Whether the client has been initialized (after updateSchema/reloadClient). */
  hasClient(): boolean {
    return this.prismaClient != null;
  }

  /**
   * Return the current Prisma client. Throws if not initialized (call updateSchema first).
   */
  getClient<T = unknown>(): T {
    if (!this.prismaClient) {
      throw new Error(
        "[PrismaManager] Client not initialized. Call bootstrapFromCurrentSchema() or updateSchema() first."
      );
    }
    return this.prismaClient as T;
  }
}
