/**
 * Merge plugin models into core parsed schema.
 * Extend existing models with new fields; add new models; detect conflicts.
 */

import type { ParsedModel } from "./types.js";
import { parsePluginSchema } from "./parse.js";
import type { MergeResult, SchemaPreview } from "./types.js";

/**
 * Merge plugin schema content (Prisma model blocks as string) into the current merged state.
 * - If model is new: add entire model.
 * - If model exists: add new fields only (throw if field already exists).
 */
export function mergePluginContent(merged: MergeResult, pluginSlug: string, content: string): void {
  const pluginModels = parsePluginSchema(content);
  mergeParsedModelsInto(merged, pluginSlug, pluginModels);
}

/**
 * Merge plugin schema (models only) from file into the current merged state.
 * - If model is new: add entire model.
 * - If model exists: add new fields only (throw if field already exists).
 * Merge order: add new models first, then extend existing (so relation targets exist).
 */
export function mergePluginInto(
  merged: MergeResult,
  pluginSlug: string,
  pluginSchemaPath: string,
  readFile: (path: string) => string
): void {
  const content = readFile(pluginSchemaPath);
  const pluginModels = parsePluginSchema(content);
  mergeParsedModelsInto(merged, pluginSlug, pluginModels);
}

function mergeParsedModelsInto(
  merged: MergeResult,
  pluginSlug: string,
  pluginModels: Map<string, ParsedModel>
): void {

  // First pass: add all new models (with all their fields)
  for (const [modelName, model] of pluginModels) {
    if (!merged.models.has(modelName)) {
      merged.models.set(modelName, { name: model.name, fields: [...model.fields] });
      merged.modelOrigin.set(modelName, pluginSlug);
      for (const f of model.fields) {
        if (f.name) merged.fieldOrigin.set(`${modelName}.${f.name}`, pluginSlug);
      }
    }
  }

  // Second pass: extend existing models (core or from previous plugins) with new fields only
  for (const [modelName, model] of pluginModels) {
    const origin = merged.modelOrigin.get(modelName);
    if (origin === pluginSlug) continue; // we just added this model in first pass; skip
    const existing = merged.models.get(modelName);
    if (!existing) continue;
    const existingFieldNames = new Set(existing.fields.filter((f) => f.name).map((f) => f.name));

    for (const field of model.fields) {
      if (!field.name) {
        existing.fields.push(field);
        continue;
      }
      if (existingFieldNames.has(field.name)) {
        const origin = merged.fieldOrigin.get(`${modelName}.${field.name}`) ?? "core";
        throw new Error(
          `Schema conflict: plugin "${pluginSlug}" adds field "${modelName}.${field.name}" but it already exists (from ${origin}).`
        );
      }
      existing.fields.push(field);
      existingFieldNames.add(field.name);
      merged.fieldOrigin.set(`${modelName}.${field.name}`, pluginSlug);
    }
  }
}

/**
 * Build schema preview (tables added, columns added) from merge result vs core-only.
 */
export function buildPreview(
  merged: MergeResult,
  coreModelNames: Set<string>,
  enabledPlugins: string[]
): SchemaPreview {
  const tablesAdded: string[] = [];
  const columnsAdded: Array<{ model: string; field: string; type: string; plugin: string }> = [];
  const warnings: string[] = [];

  for (const [modelName, model] of merged.models) {
    const origin = merged.modelOrigin.get(modelName);
    if (origin && origin !== "core" && enabledPlugins.includes(origin)) {
      if (!coreModelNames.has(modelName)) tablesAdded.push(modelName);
    }
  }

  for (const [key, plugin] of merged.fieldOrigin) {
    if (plugin === "core" || !enabledPlugins.includes(plugin)) continue;
    const [modelName, fieldName] = key.split(".");
    const model = merged.models.get(modelName);
    const field = model?.fields.find((f) => f.name === fieldName);
    const type = field ? inferTypeFromRaw(field.raw) : "unknown";
    columnsAdded.push({ model: modelName, field: fieldName, type, plugin });
  }

  return { tablesAdded, columnsAdded, warnings };
}

/** Infer Prisma type from field raw line (e.g. "Int", "String?", "UserRelation[]"). */
function inferTypeFromRaw(raw: string): string {
  const withoutComment = raw.replace(/\/\/.*$/, "").trim();
  const match = withoutComment.match(/^\w+\s+(\S+)/);
  return match ? match[1] : "unknown";
}
