/**
 * Database Introspector
 *
 * Reads the actual state of plugin tables from the live SQLite database
 * using PRAGMA commands. This is used by the diff engine to compare
 * the desired schema (from plugin definitions) against reality.
 */

import type { PrismaClient } from "@prisma/client";
import type {
  IntrospectedTable,
  IntrospectedColumn,
  IntrospectedIndex,
  IntrospectedForeignKey,
} from "./types";

// ---------------------------------------------------------------------------
// PRAGMA Row Types (raw query results from SQLite)
// ---------------------------------------------------------------------------

type PragmaTableInfo = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

type PragmaIndexList = {
  seq: number;
  name: string;
  unique: number;
  origin: string; // "c" = CREATE INDEX, "pk" = PRIMARY KEY, "u" = UNIQUE constraint
  partial: number;
};

type PragmaIndexInfo = {
  seqno: number;
  cid: number;
  name: string;
};

type PragmaForeignKeyList = {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
  match: string;
};

// ---------------------------------------------------------------------------
// Introspection Functions
// ---------------------------------------------------------------------------

/**
 * Check whether a table exists in the database.
 */
export async function tableExists(
  prisma: PrismaClient,
  tableName: string
): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    tableName
  );
  return rows.length > 0;
}

/**
 * List all plugin tables (tables starting with "plugin_").
 */
export async function listPluginTables(
  prisma: PrismaClient
): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'plugin_%' ORDER BY name`
  );
  return rows.map((r) => r.name);
}

/**
 * Escape SQL LIKE wildcards in a string so they are matched literally.
 * Order: backslashes first, then '%', then '_'. Use with ESCAPE '\'.
 */
function escapeLikeWildcards(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 * List all plugin tables belonging to a specific plugin slug.
 */
export async function listPluginTablesForSlug(
  prisma: PrismaClient,
  pluginSlug: string
): Promise<string[]> {
  const escapedSlug = escapeLikeWildcards(pluginSlug);
  const pattern = `plugin_${escapedSlug}_%`;
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ? ESCAPE '\\' ORDER BY name`,
    pattern
  );
  return rows.map((r) => r.name);
}

/**
 * Introspect a single table's full schema.
 */
export async function introspectTable(
  prisma: PrismaClient,
  tableName: string
): Promise<IntrospectedTable | null> {
  const exists = await tableExists(prisma, tableName);
  if (!exists) return null;

  const [columns, indexes, foreignKeys] = await Promise.all([
    introspectColumns(prisma, tableName),
    introspectIndexes(prisma, tableName),
    introspectForeignKeys(prisma, tableName),
  ]);

  return { name: tableName, columns, indexes, foreignKeys };
}

/**
 * Introspect all plugin tables for a given plugin slug.
 */
export async function introspectPluginTables(
  prisma: PrismaClient,
  pluginSlug: string
): Promise<Map<string, IntrospectedTable>> {
  const tableNames = await listPluginTablesForSlug(prisma, pluginSlug);
  const result = new Map<string, IntrospectedTable>();

  for (const name of tableNames) {
    const table = await introspectTable(prisma, name);
    if (table) result.set(name, table);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Column Introspection
// ---------------------------------------------------------------------------

async function introspectColumns(
  prisma: PrismaClient,
  tableName: string
): Promise<IntrospectedColumn[]> {
  const rows = await prisma.$queryRawUnsafe<PragmaTableInfo[]>(
    `PRAGMA table_info("${escapeSqlIdentifier(tableName)}")`
  );

  return rows.map((row) => ({
    name: row.name,
    type: row.type.toUpperCase(),
    notNull: row.notnull === 1,
    defaultValue: row.dflt_value,
    primaryKey: row.pk === 1,
  }));
}

// ---------------------------------------------------------------------------
// Index Introspection
// ---------------------------------------------------------------------------

async function introspectIndexes(
  prisma: PrismaClient,
  tableName: string
): Promise<IntrospectedIndex[]> {
  const indexList = await prisma.$queryRawUnsafe<PragmaIndexList[]>(
    `PRAGMA index_list("${escapeSqlIdentifier(tableName)}")`
  );

  const result: IntrospectedIndex[] = [];

  for (const idx of indexList) {
    const indexInfo = await prisma.$queryRawUnsafe<PragmaIndexInfo[]>(
      `PRAGMA index_info("${escapeSqlIdentifier(idx.name)}")`
    );

    result.push({
      name: idx.name,
      columns: indexInfo.sort((a, b) => a.seqno - b.seqno).map((i) => i.name),
      unique: idx.unique === 1,
      origin: idx.origin as IntrospectedIndex["origin"],
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Foreign Key Introspection
// ---------------------------------------------------------------------------

async function introspectForeignKeys(
  prisma: PrismaClient,
  tableName: string
): Promise<IntrospectedForeignKey[]> {
  const rows = await prisma.$queryRawUnsafe<PragmaForeignKeyList[]>(
    `PRAGMA foreign_key_list("${escapeSqlIdentifier(tableName)}")`
  );

  return rows.map((row) => ({
    fromColumn: row.from,
    toTable: row.table,
    toColumn: row.to,
    onDelete: row.on_delete,
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escape a SQL identifier to prevent injection in PRAGMA statements.
 * Only allows alphanumeric characters and underscores.
 */
function escapeSqlIdentifier(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid SQL identifier: "${name}"`);
  }
  return name;
}
