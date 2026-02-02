/**
 * Helpers for plugins that provide Prisma schema (schema.prisma or manifest.database).
 * Used by enable/preview routes and createApp to wire SchemaMerger and PrismaManager.
 * Dual-layer: basic manifest.database is converted to Prisma and merged the same way as schema.prisma.
 */

import fs from "node:fs";
import path from "node:path";
import type { ResolvedNomosConfig } from "../config/nomos-config";
import type { DiscoveredPlugin } from "../plugins/types";
import type { PluginDatabaseDefinition } from "./pluginSchema/types";
import { PrismaManager } from "./prisma-manager";
import { previewSchemaChanges } from "./schema/schema-merger";
import type { SchemaPreview } from "./schema/schema-merger";
import { pluginDatabaseDefinitionToPrismaSchema } from "./schema/manifest-to-prisma";

/** Check if a plugin directory contains a Prisma schema file. */
export function hasPluginPrismaSchema(pluginFolderPath: string): boolean {
  return fs.existsSync(path.join(pluginFolderPath, "schema.prisma"));
}

/** Build PrismaManager and schema-merger options from config and cwd. */
export function getPluginPrismaOptions(config: ResolvedNomosConfig): {
  appRoot: string;
  coreSchemaPath: string;
  outputSchemaPath: string;
  pluginsDir: string;
} {
  const appRoot = process.cwd();
  const pluginsDir = path.resolve(appRoot, config.modules.pluginManager.discovery.pluginDir);
  return {
    appRoot,
    coreSchemaPath: path.join(appRoot, "prisma", "core-schema.prisma"),
    outputSchemaPath: path.join(appRoot, "prisma", "schema.prisma"),
    pluginsDir,
  };
}

/** Get PrismaManager singleton with options from config. */
export function getPrismaManager(config: ResolvedNomosConfig): PrismaManager {
  const opts = getPluginPrismaOptions(config);
  return PrismaManager.getInstance({
    appRoot: opts.appRoot,
    coreSchemaPath: opts.coreSchemaPath,
    outputSchemaPath: opts.outputSchemaPath,
    pluginsDir: opts.pluginsDir,
  });
}

/**
 * Build a resolver (slug -> schema content) from discovered plugins.
 * For each slug: if plugin has schema.prisma file, return its content;
 * else if plugin has manifest.database, return converted Prisma schema; else null.
 */
export function buildGetPluginSchemaContent(
  discovered: Array<Pick<DiscoveredPlugin, "slug" | "folderPath" | "manifest">>
): (slug: string) => string | null {
  return (slug: string) => {
    const plugin = discovered.find((p) => p.slug === slug);
    if (!plugin) return null;
    const schemaPath = path.join(plugin.folderPath, "schema.prisma");
    if (fs.existsSync(schemaPath)) {
      return fs.readFileSync(schemaPath, "utf-8");
    }
    const def = plugin.manifest?.database as PluginDatabaseDefinition | undefined;
    if (def?.tables && typeof def.tables === "object") {
      return pluginDatabaseDefinitionToPrismaSchema(slug, def);
    }
    return null;
  };
}

/**
 * Preview schema changes for enabled plugins (including the one being enabled).
 * Returns tablesAdded, columnsAdded, warnings for the admin.
 * When getPluginSchemaContent is provided, used to resolve schema (file or manifest.database).
 */
export async function getSchemaPreview(
  enabledPluginsIncludingNew: string[],
  config: ResolvedNomosConfig,
  getPluginSchemaContent?: (slug: string) => string | null
): Promise<SchemaPreview> {
  const opts = getPluginPrismaOptions(config);
  return previewSchemaChanges(enabledPluginsIncludingNew, {
    corePath: opts.coreSchemaPath,
    pluginsDir: opts.pluginsDir,
    outputPath: opts.outputSchemaPath,
    getPluginSchemaContent,
  });
}
