/**
 * Schema merger: merges core Prisma schema with enabled plugin schemas.
 * Supports mergeSchemas (write merged schema to file) and previewSchemaChanges (return preview for admin).
 */

import fs from "node:fs";
import path from "node:path";
import { parseSchema } from "./parse.js";
import { mergePluginInto, mergePluginContent, buildPreview } from "./merge.js";
import { emitSchema } from "./emit.js";
import type { MergeResult, ParsedSchema, SchemaPreview } from "./types.js";

export type SchemaMergerOptions = {
  corePath: string;
  pluginsDir: string;
  outputPath: string;
  /**
   * Optional: resolve plugin schema content by slug (file or converted manifest.database).
   * If provided, called for each enabled plugin; if it returns a string, that content is merged.
   * If it returns null/undefined, merger falls back to reading pluginsDir/slug/schema.prisma from disk.
   */
  getPluginSchemaContent?: (slug: string) => string | null;
};

/**
 * Read core schema and build initial merge result (core-only).
 */
function loadCoreAndStartMerge(corePath: string): { core: ParsedSchema; merged: MergeResult } {
  const coreContent = fs.readFileSync(corePath, "utf-8");
  const core = parseSchema(coreContent);
  const merged: MergeResult = {
    models: new Map(core.models),
    modelOrigin: new Map(),
    fieldOrigin: new Map(),
  };
  for (const name of core.models.keys()) {
    merged.modelOrigin.set(name, "core");
    const model = core.models.get(name)!;
    for (const f of model.fields) {
      if (f.name) merged.fieldOrigin.set(`${name}.${f.name}`, "core");
    }
  }
  return { core, merged };
}

/**
 * Compute merged schema content (core + enabled plugins) without writing.
 * Throws on conflict or parse error.
 */
export function getMergedSchemaContent(
  enabledPlugins: string[],
  options: SchemaMergerOptions
): string {
  const { corePath, pluginsDir } = options;
  const { core, merged } = loadCoreAndStartMerge(corePath);

  const sortedPlugins = [...enabledPlugins].sort();
  for (const slug of sortedPlugins) {
    const content =
      options.getPluginSchemaContent?.(slug) ??
      (fs.existsSync(path.join(pluginsDir, slug, "schema.prisma"))
        ? fs.readFileSync(path.join(pluginsDir, slug, "schema.prisma"), "utf-8")
        : null);
    if (content) mergePluginContent(merged, slug, content);
  }

  return emitSchema(core, merged);
}

/**
 * Merge enabled plugin schemas into one, write to outputPath only if content changed.
 * Avoids touching the file when unchanged so file watchers (e.g. tsx watch) don't restart.
 * Returns true if the file was written, false if it was skipped (content unchanged).
 * Throws on conflict or parse error.
 */
export function mergeSchemas(
  enabledPlugins: string[],
  options: SchemaMergerOptions
): boolean {
  const { outputPath } = options;
  const output = getMergedSchemaContent(enabledPlugins, options);

  const existing = fs.existsSync(outputPath)
    ? fs.readFileSync(outputPath, "utf-8")
    : null;
  if (existing === output) {
    return false;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output, "utf-8");
  return true;
}

/**
 * Same merge in memory; return preview (tables added, columns added) for admin.
 * Does not write any file.
 */
export function previewSchemaChanges(
  enabledPlugins: string[],
  options: SchemaMergerOptions
): SchemaPreview {
  const { corePath, pluginsDir } = options;
  const { core, merged } = loadCoreAndStartMerge(corePath);
  const coreModelNames = new Set(core.models.keys());

  const sortedPlugins = [...enabledPlugins].sort();
  for (const slug of sortedPlugins) {
    const content =
      options.getPluginSchemaContent?.(slug) ??
      (fs.existsSync(path.join(pluginsDir, slug, "schema.prisma"))
        ? fs.readFileSync(path.join(pluginsDir, slug, "schema.prisma"), "utf-8")
        : null);
    if (content) mergePluginContent(merged, slug, content);
  }

  return buildPreview(merged, coreModelNames, enabledPlugins);
}

export type { SchemaPreview } from "./types.js";
