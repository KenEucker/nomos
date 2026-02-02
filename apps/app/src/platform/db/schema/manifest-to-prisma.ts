/**
 * Converts PluginDatabaseDefinition (manifest.database) into Prisma model blocks.
 * Enables the dual-layer: basic additions from JSON-like manifest are turned into
 * Prisma schema and merged the same way as plugin schema.prisma files.
 *
 * Table naming: model names are unique per plugin (Slug_TableName); DB table names
 * use @@map("plugin_slug_tablename") to match the previous pluginSchema convention.
 */

import type {
  PluginDatabaseDefinition,
  TableDefinition,
  ColumnDefinition,
  ColumnType,
  ColumnReference,
  IndexDefinition,
} from "../pluginSchema/types.js";

const PRISMA_TYPE_MAP: Record<ColumnType, string> = {
  text: "String",
  integer: "Int",
  real: "Float",
  boolean: "Boolean",
  datetime: "DateTime",
  json: "Json",
};

/** Slug to PascalCase for model prefix (e.g. "loyalty" → "Loyalty"). */
function slugToPascal(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join("");
}

/** Table key to PascalCase (e.g. "loyalty_transaction" → "LoyaltyTransaction"). */
function tableKeyToPascal(key: string): string {
  return key
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join("");
}

/** Qualified DB table name for @@map (plugin_slug_tablename). */
function qualifiedTableName(pluginSlug: string, tableKey: string): string {
  const s = pluginSlug.toLowerCase().replace(/[-]/g, "_");
  const t = tableKey.toLowerCase().replace(/[-]/g, "_");
  return `plugin_${s}_${t}`;
}

/** Resolve referenced model name: core tables stay as-is; same-plugin tables get Slug_TableName. */
function resolveRefModel(refTable: string, pluginSlug: string, slugPascal: string): string {
  const core = ["User", "Role", "Permission", "RolePermission", "UserRole", "SubjectRole", "ApiKey", "Session", "PluginState", "JobRun"];
  if (core.includes(refTable)) return refTable;
  return `${slugPascal}_${tableKeyToPascal(refTable)}`;
}

/** Build map: target tableKey -> list of { sourceTableKey, sourceModelName } that reference it (same plugin), deduped by sourceModelName. */
function buildReverseRefs(definition: PluginDatabaseDefinition, slugPascal: string): Map<string, Array<{ sourceTableKey: string; sourceModelName: string }>> {
  const reverse = new Map<string, Array<{ sourceTableKey: string; sourceModelName: string }>>();
  const core = new Set(["User", "Role", "Permission", "RolePermission", "UserRole", "SubjectRole", "ApiKey", "Session", "PluginState", "JobRun"]);
  for (const [sourceTableKey, table] of Object.entries(definition.tables)) {
    const sourceModelName = `${slugPascal}_${tableKeyToPascal(sourceTableKey)}`;
    for (const col of Object.values(table.columns)) {
      if (!col.references) continue;
      const refTable = col.references.table;
      if (core.has(refTable)) continue;
      if (!definition.tables[refTable]) continue;
      const list = reverse.get(refTable) ?? [];
      if (list.some((r) => r.sourceModelName === sourceModelName)) continue;
      list.push({ sourceTableKey, sourceModelName });
      reverse.set(refTable, list);
    }
  }
  return reverse;
}

/**
 * Convert PluginDatabaseDefinition to Prisma schema string (model blocks only).
 * Model names: {SlugPascal}_{TablePascal}. Table names in DB: @@map("plugin_slug_tablename").
 * References to core models are FK columns only (no @relation) so we don't extend core.
 * References to same-plugin tables get @relation and reverse relation fields.
 */
export function pluginDatabaseDefinitionToPrismaSchema(
  pluginSlug: string,
  definition: PluginDatabaseDefinition
): string {
  if (!definition?.tables || typeof definition.tables !== "object") {
    return "";
  }
  const slugPascal = slugToPascal(pluginSlug);
  const reverseRefs = buildReverseRefs(definition, slugPascal);
  const core = new Set(["User", "Role", "Permission", "RolePermission", "UserRole", "SubjectRole", "ApiKey", "Session", "PluginState", "JobRun"]);
  const lines: string[] = [];

  for (const [tableKey, table] of Object.entries(definition.tables)) {
    const modelName = `${slugPascal}_${tableKeyToPascal(tableKey)}`;
    const mapName = qualifiedTableName(pluginSlug, tableKey);
    lines.push(`model ${modelName} {`);
    for (const [colName, col] of Object.entries(table.columns)) {
      const prismaType = PRISMA_TYPE_MAP[col.type] ?? "String";
      const optional = col.nullable ? "?" : "";
      const attrs: string[] = [];
      if (col.primaryKey) attrs.push("@id");
      if (col.unique && !col.primaryKey) attrs.push("@unique");
      if (col.default !== undefined) {
        if (col.default === "cuid") attrs.push("@default(cuid())");
        else if (col.default === "uuid") attrs.push("@default(uuid())");
        else if (col.default === "now") attrs.push("@default(now())");
        else if (typeof col.default === "string") attrs.push(`@default("${col.default.replace(/"/g, '\\"')}")`);
        else if (typeof col.default === "number") attrs.push(`@default(${col.default})`);
        else if (typeof col.default === "boolean") attrs.push(`@default(${col.default})`);
      }
      if (col.references) {
        const refTable = col.references.table;
        const isCore = core.has(refTable);
        if (!isCore) {
          const refModel = resolveRefModel(refTable, pluginSlug, slugPascal);
          const onDelete = col.references.onDelete ?? "Restrict";
          const onDeleteCap = onDelete.charAt(0).toUpperCase() + onDelete.slice(1).toLowerCase();
          attrs.push(`@relation(fields: [${colName}], references: [${col.references.column}], onDelete: ${onDeleteCap})`);
        }
      }
      const attrStr = attrs.length ? " " + attrs.join(" ") : "";
      lines.push(`  ${colName} ${prismaType}${optional}${attrStr}`);
    }
    const backRefs = reverseRefs.get(tableKey) ?? [];
    for (const { sourceTableKey, sourceModelName } of backRefs) {
      const relationName = sourceTableKey
        .split(/[-_]/)
        .map((s, i) => (i === 0 ? s.toLowerCase() : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()))
        .join("");
      lines.push(`  ${relationName} ${sourceModelName}[]`);
    }
    if (table.indexes?.length) {
      for (const idx of table.indexes) {
        const cols = idx.columns.join(", ");
        if (idx.unique) {
          lines.push(`  @@unique([${cols}])`);
        } else {
          lines.push(`  @@index([${cols}])`);
        }
      }
    }
    lines.push(`  @@map("${mapName}")`);
    lines.push("}");
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
