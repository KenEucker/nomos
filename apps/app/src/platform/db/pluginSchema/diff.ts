/**
 * Schema Diff Engine
 *
 * Compares a plugin's desired database schema (from its manifest) against
 * the actual state of the database (from introspection) and produces
 * a list of SQL actions needed to reconcile them.
 *
 * Design principles (inspired by WordPress dbDelta, improved):
 *  - Declarative: plugin defines desired end-state, engine computes the diff.
 *  - Non-destructive: never drops columns or tables during enable/disable.
 *    Only drop_table actions are generated for explicit uninstall.
 *  - Idempotent: running the diff on an already-synced database produces
 *    zero actions.
 *  - Structured: uses typed schema objects, not regex-parsed SQL.
 */

import type { PrismaClient } from "@prisma/client";
import type {
  PluginDatabaseDefinition,
  TableDefinition,
  ColumnDefinition,
  IndexDefinition,
  IntrospectedTable,
  IntrospectedColumn,
  SchemaAction,
  SchemaDiffResult,
  ColumnType,
} from "./types";
import { introspectPluginTables, introspectTable } from "./introspect";
import { qualifyTableName, generateIndexName } from "./validate";

// ---------------------------------------------------------------------------
// Column Type Mapping
// ---------------------------------------------------------------------------

/** Map our logical types to SQLite storage types (TEXT for JSON affinity; SQLite has no JSONB). */
const SQL_TYPE_MAP: Record<ColumnType, string> = {
  text: "TEXT",
  integer: "INTEGER",
  real: "REAL",
  boolean: "BOOLEAN",
  datetime: "DATETIME",
  json: "TEXT",
};

/** Normalize an introspected type string for comparison (JSON/JSONB → TEXT for SQLite affinity). */
function normalizeType(type: string): string {
  const upper = type.toUpperCase().trim();
  // SQLite is flexible with types; normalize common variants
  if (upper === "INT") return "INTEGER";
  if (upper === "BOOL") return "BOOLEAN";
  if (upper === "JSON" || upper === "JSONB") return "TEXT";
  if (upper === "DOUBLE" || upper === "FLOAT") return "REAL";
  if (upper.startsWith("VARCHAR") || upper.startsWith("CHAR") || upper === "CLOB") return "TEXT";
  return upper;
}

// ---------------------------------------------------------------------------
// SQL Generation Helpers
// ---------------------------------------------------------------------------

function columnSql(
  colName: string,
  colDef: ColumnDefinition,
  pluginSlug: string
): string {
  const parts: string[] = [`"${colName}"`];

  parts.push(SQL_TYPE_MAP[colDef.type] ?? "TEXT");

  if (colDef.primaryKey) {
    parts.push("NOT NULL PRIMARY KEY");
  } else if (!colDef.nullable) {
    parts.push("NOT NULL");
  }

  if (colDef.unique && !colDef.primaryKey) {
    parts.push("UNIQUE");
  }

  const defaultSql = defaultValueSql(colDef);
  if (defaultSql !== null) {
    parts.push(`DEFAULT ${defaultSql}`);
  }

  if (colDef.references) {
    const refTable = resolveReferenceTable(colDef.references.table, pluginSlug);
    const onDelete = colDef.references.onDelete?.toUpperCase() ?? "RESTRICT";
    parts.push(
      `REFERENCES "${refTable}" ("${colDef.references.column}") ON DELETE ${onDelete}`
    );
  }

  return parts.join(" ");
}

function defaultValueSql(colDef: ColumnDefinition): string | null {
  if (colDef.default === undefined) return null;

  switch (colDef.default) {
    case "now":
      return "CURRENT_TIMESTAMP";
    case "cuid":
    case "uuid":
      // These are generated at insert time by the query builder, not by SQLite
      return null;
    default:
      if (typeof colDef.default === "string") return `'${colDef.default.replace(/'/g, "''")}'`;
      if (typeof colDef.default === "number") return String(colDef.default);
      if (typeof colDef.default === "boolean") return colDef.default ? "1" : "0";
      return null;
  }
}

/**
 * Resolve a reference table name. Core tables are used as-is.
 * Short names from the same plugin are qualified.
 */
function resolveReferenceTable(refTable: string, pluginSlug: string): string {
  // Core platform tables are PascalCase (User, Role, etc.)
  if (/^[A-Z]/.test(refTable)) return refTable;
  // Already qualified
  if (refTable.startsWith("plugin_")) return refTable;
  // Short name → qualify
  return qualifyTableName(pluginSlug, refTable);
}

// ---------------------------------------------------------------------------
// CREATE TABLE SQL
// ---------------------------------------------------------------------------

function createTableSql(
  qualifiedName: string,
  tableDef: TableDefinition,
  pluginSlug: string
): string {
  const colLines: string[] = [];

  for (const [colName, colDef] of Object.entries(tableDef.columns)) {
    colLines.push(`  ${columnSql(colName, colDef, pluginSlug)}`);
  }

  return `CREATE TABLE "${qualifiedName}" (\n${colLines.join(",\n")}\n)`;
}

// ---------------------------------------------------------------------------
// ALTER TABLE ADD COLUMN SQL
// ---------------------------------------------------------------------------

function addColumnSql(
  qualifiedTable: string,
  colName: string,
  colDef: ColumnDefinition,
  pluginSlug: string
): string {
  // SQLite ALTER TABLE ADD COLUMN has restrictions:
  // - Cannot add PRIMARY KEY columns
  // - Cannot add UNIQUE columns (must create index separately)
  // - NOT NULL columns must have a DEFAULT
  const parts: string[] = [`ALTER TABLE "${qualifiedTable}" ADD COLUMN`];
  const colParts: string[] = [`"${colName}"`, SQL_TYPE_MAP[colDef.type] ?? "TEXT"];

  if (!colDef.nullable && !colDef.primaryKey) {
    // SQLite requires a default for NOT NULL added columns
    const dflt = defaultValueSql(colDef);
    if (dflt !== null) {
      colParts.push("NOT NULL");
      colParts.push(`DEFAULT ${dflt}`);
    } else if (colDef.default === "cuid" || colDef.default === "uuid") {
      // App-generated defaults: column must be nullable in DB, app fills on insert
      // Warn about this in the diff result
    } else {
      // Must be nullable if no default can be expressed
      // The diff will emit a warning
    }
  }

  if (colDef.references) {
    const refTable = resolveReferenceTable(colDef.references.table, pluginSlug);
    const onDelete = colDef.references.onDelete?.toUpperCase() ?? "RESTRICT";
    colParts.push(
      `REFERENCES "${refTable}" ("${colDef.references.column}") ON DELETE ${onDelete}`
    );
  }

  parts.push(colParts.join(" "));
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// CREATE INDEX SQL
// ---------------------------------------------------------------------------

function createIndexSql(
  qualifiedTable: string,
  indexName: string,
  indexDef: IndexDefinition
): string {
  const uniqueStr = indexDef.unique ? "UNIQUE " : "";
  const cols = indexDef.columns.map((c) => `"${c}"`).join(", ");
  return `CREATE ${uniqueStr}INDEX IF NOT EXISTS "${indexName}" ON "${qualifiedTable}" (${cols})`;
}

// ---------------------------------------------------------------------------
// DROP TABLE SQL
// ---------------------------------------------------------------------------

function dropTableSql(qualifiedName: string): string {
  return `DROP TABLE IF EXISTS "${qualifiedName}"`;
}

// ---------------------------------------------------------------------------
// Main Diff Function
// ---------------------------------------------------------------------------

/**
 * Compute the diff between a plugin's desired schema and the actual database.
 *
 * @param prisma       Prisma client for database introspection.
 * @param pluginSlug   The plugin's slug.
 * @param definition   The desired schema from the plugin manifest.
 * @returns            A diff result with actions, summaries, and warnings.
 */
export async function computeSchemaDiff(
  prisma: PrismaClient,
  pluginSlug: string,
  definition: PluginDatabaseDefinition
): Promise<SchemaDiffResult> {
  const actions: SchemaAction[] = [];
  const summary: string[] = [];
  const warnings: string[] = [];

  // Introspect all existing tables for this plugin
  const existingTables = await introspectPluginTables(prisma, pluginSlug);

  for (const [shortName, tableDef] of Object.entries(definition.tables)) {
    const qualifiedName = qualifyTableName(pluginSlug, shortName);
    const existing = existingTables.get(qualifiedName);

    if (!existing) {
      // Table does not exist → CREATE TABLE
      const sql = createTableSql(qualifiedName, tableDef, pluginSlug);
      actions.push({ kind: "create_table", table: qualifiedName, sql });
      summary.push(`Create table "${qualifiedName}" with ${Object.keys(tableDef.columns).length} columns.`);

      // Also create indexes for new tables
      if (tableDef.indexes) {
        for (const indexDef of tableDef.indexes) {
          const indexName =
            indexDef.name ?? generateIndexName(pluginSlug, shortName, indexDef.columns, indexDef.unique);
          const sql = createIndexSql(qualifiedName, indexName, indexDef);
          actions.push({ kind: "create_index", table: qualifiedName, index: indexName, sql });
          summary.push(`Create index "${indexName}" on "${qualifiedName}" (${indexDef.columns.join(", ")}).`);
        }
      }
    } else {
      // Table exists → diff columns and indexes
      diffColumns(qualifiedName, shortName, tableDef, existing, pluginSlug, actions, summary, warnings);
      diffIndexes(qualifiedName, shortName, tableDef, existing, pluginSlug, actions, summary, warnings);
    }
  }

  return {
    actions,
    summary,
    warnings,
    hasChanges: actions.length > 0,
  };
}

/**
 * Compute the actions needed to fully remove a plugin's tables.
 * Only used during uninstall.
 */
export async function computeDropDiff(
  prisma: PrismaClient,
  pluginSlug: string
): Promise<SchemaDiffResult> {
  const actions: SchemaAction[] = [];
  const summary: string[] = [];
  const existingTables = await introspectPluginTables(prisma, pluginSlug);

  // Drop in reverse order to respect foreign key dependencies
  const tableNames = [...existingTables.keys()].reverse();
  for (const name of tableNames) {
    const sql = dropTableSql(name);
    actions.push({ kind: "drop_table", table: name, sql });
    summary.push(`Drop table "${name}".`);
  }

  return {
    actions,
    summary,
    warnings: [],
    hasChanges: actions.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Column Diff
// ---------------------------------------------------------------------------

function diffColumns(
  qualifiedName: string,
  shortName: string,
  desired: TableDefinition,
  existing: IntrospectedTable,
  pluginSlug: string,
  actions: SchemaAction[],
  summary: string[],
  warnings: string[]
): void {
  const existingColNames = new Set(existing.columns.map((c) => c.name));

  for (const [colName, colDef] of Object.entries(desired.columns)) {
    if (!existingColNames.has(colName)) {
      // New column → ADD COLUMN
      const sql = addColumnSql(qualifiedName, colName, colDef, pluginSlug);
      actions.push({ kind: "add_column", table: qualifiedName, column: colName, sql });
      summary.push(`Add column "${colName}" to "${qualifiedName}".`);

      // Enforce UNIQUE via a separate index (SQLite ADD COLUMN cannot add UNIQUE inline)
      if (colDef.unique && !colDef.primaryKey) {
        const indexName = generateIndexName(pluginSlug, shortName, [colName], true);
        const indexSql = createIndexSql(qualifiedName, indexName, { columns: [colName], unique: true });
        actions.push({ kind: "create_index", table: qualifiedName, index: indexName, sql: indexSql });
        summary.push(`Create unique index "${indexName}" on "${qualifiedName}" (${colName}).`);
      }

      // Warn about NOT NULL columns without SQLite-expressible defaults
      if (!colDef.nullable && !colDef.primaryKey) {
        const dflt = defaultValueSql(colDef);
        if (dflt === null) {
          warnings.push(
            `Column "${colName}" on "${qualifiedName}" is NOT NULL but has no SQL-expressible default ` +
              `(default "${colDef.default}" is generated by the application). ` +
              `SQLite requires a DEFAULT for NOT NULL columns added via ALTER TABLE. ` +
              `The column will be created as nullable in the database; the query builder ` +
              `will enforce NOT NULL at the application level.`
          );
        }
      }
    } else {
      // Column exists → check for type mismatches (warn only, SQLite can't ALTER COLUMN)
      const existingCol = existing.columns.find((c) => c.name === colName)!;
      checkColumnMismatch(qualifiedName, colName, colDef, existingCol, warnings);
    }
  }

  // Check for columns in DB that are NOT in the desired schema (warn, don't drop)
  for (const existingCol of existing.columns) {
    if (!(existingCol.name in desired.columns)) {
      warnings.push(
        `Column "${existingCol.name}" exists in "${qualifiedName}" but is not in the ` +
          `plugin schema. It will NOT be dropped (non-destructive policy). ` +
          `Remove it manually if no longer needed.`
      );
    }
  }
}

function checkColumnMismatch(
  qualifiedName: string,
  colName: string,
  desired: ColumnDefinition,
  existing: IntrospectedColumn,
  warnings: string[]
): void {
  const desiredType = SQL_TYPE_MAP[desired.type] ?? "TEXT";
  const existingType = normalizeType(existing.type);

  if (desiredType !== existingType) {
    warnings.push(
      `Column "${colName}" on "${qualifiedName}": type mismatch. ` +
        `Desired: ${desiredType}, actual: ${existingType}. ` +
        `SQLite does not support ALTER COLUMN; the column type cannot be changed ` +
        `without recreating the table. If this is intentional, manually migrate the data.`
    );
  }

  // NOT NULL mismatch
  const desiredNotNull = !desired.nullable && !desired.primaryKey;
  if (desiredNotNull && !existing.notNull) {
    warnings.push(
      `Column "${colName}" on "${qualifiedName}": desired NOT NULL but actual is nullable. ` +
        `SQLite does not support ALTER COLUMN to add NOT NULL.`
    );
  }
}

// ---------------------------------------------------------------------------
// Index Diff
// ---------------------------------------------------------------------------

function diffIndexes(
  qualifiedName: string,
  shortName: string,
  desired: TableDefinition,
  existing: IntrospectedTable,
  pluginSlug: string,
  actions: SchemaAction[],
  summary: string[],
  _warnings: string[]
): void {
  if (!desired.indexes) return;

  // Build a set of existing index signatures for comparison
  const existingIndexSigs = new Set(
    existing.indexes
      .filter((idx) => idx.origin === "c") // only user-created indexes
      .map((idx) => indexSignature(idx.columns, idx.unique))
  );

  for (const indexDef of desired.indexes) {
    const sig = indexSignature(indexDef.columns, indexDef.unique ?? false);
    if (!existingIndexSigs.has(sig)) {
      const indexName =
        indexDef.name ?? generateIndexName(pluginSlug, shortName, indexDef.columns, indexDef.unique);
      const sql = createIndexSql(qualifiedName, indexName, indexDef);
      actions.push({ kind: "create_index", table: qualifiedName, index: indexName, sql });
      summary.push(`Create index "${indexName}" on "${qualifiedName}" (${indexDef.columns.join(", ")}).`);
    }
  }
}

/** Produce a comparable string for an index's column list + uniqueness. */
function indexSignature(columns: string[], unique: boolean): string {
  return `${unique ? "U" : "N"}:${columns.join(",")}`;
}
