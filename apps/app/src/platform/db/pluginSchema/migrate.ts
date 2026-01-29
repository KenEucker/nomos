/**
 * Migration Executor
 *
 * Applies schema diff actions to the database safely. All actions for a
 * single plugin are run within a transaction so that a failure rolls back
 * all changes for that plugin (unlike WordPress's dbDelta which has no
 * transactional protection).
 *
 * Also handles the "enable foreign keys" PRAGMA required for SQLite
 * foreign key enforcement.
 */

import type { PrismaClient } from "@prisma/client";
import type { SchemaAction, SchemaDiffResult } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MigrationResult = {
  success: boolean;
  /** Actions that were executed successfully. */
  applied: SchemaAction[];
  /** The action that failed (if any). */
  failedAction?: SchemaAction;
  /** Error message if the migration failed. */
  error?: string;
  /** Full error details for debugging. */
  errorDetail?: string;
  /** Warnings from the diff (carried through for reporting). */
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Migration Executor
// ---------------------------------------------------------------------------

/**
 * Apply a schema diff to the database.
 *
 * All actions are executed in order within a single transaction.
 * If any action fails, all changes are rolled back.
 *
 * @param prisma  Prisma client for database access.
 * @param diff    The computed schema diff to apply.
 * @returns       Result indicating success/failure and details.
 */
export async function applyMigration(
  prisma: PrismaClient,
  diff: SchemaDiffResult
): Promise<MigrationResult> {
  if (!diff.hasChanges) {
    return {
      success: true,
      applied: [],
      warnings: diff.warnings,
    };
  }

  const applied: SchemaAction[] = [];

  try {
    await prisma.$transaction(async (tx) => {
      // Enable foreign key enforcement on the same connection as the transaction
      await tx.$executeRawUnsafe(`PRAGMA foreign_keys = ON`);

      for (const action of diff.actions) {
        await tx.$executeRawUnsafe(action.sql);
        applied.push(action);
      }
    });

    return {
      success: true,
      applied,
      warnings: diff.warnings,
    };
  } catch (error) {
    const failedAction = diff.actions[applied.length];
    const message = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      applied,
      failedAction,
      error: buildErrorMessage(failedAction, message),
      errorDetail: error instanceof Error ? error.stack ?? message : message,
      warnings: diff.warnings,
    };
  }
}

/**
 * Verify that a migration was applied correctly by re-introspecting.
 *
 * This is an optional post-migration check that can be used during
 * the preview/install flow to give the plugin developer confidence
 * that their schema was applied correctly.
 */
export async function verifyMigration(
  prisma: PrismaClient,
  diff: SchemaDiffResult
): Promise<{ verified: boolean; missingTables: string[]; missingColumns: string[] }> {
  const missingTables: string[] = [];
  const missingColumns: string[] = [];

  for (const action of diff.actions) {
    if (action.kind === "create_table") {
      const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        action.table
      );
      if (rows.length === 0) {
        missingTables.push(action.table);
      }
    }

    if (action.kind === "add_column") {
      const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
        `PRAGMA table_info("${escapeIdentifier(action.table)}")`
      );
      const colNames = rows.map((r: any) => r.name);
      if (!colNames.includes(action.column)) {
        missingColumns.push(`${action.table}.${action.column}`);
      }
    }
  }

  return {
    verified: missingTables.length === 0 && missingColumns.length === 0,
    missingTables,
    missingColumns,
  };
}

// ---------------------------------------------------------------------------
// Error Formatting
// ---------------------------------------------------------------------------

function buildErrorMessage(action: SchemaAction | undefined, rawError: string): string {
  if (!action) {
    return `Plugin schema migration failed: ${rawError}`;
  }

  switch (action.kind) {
    case "create_table":
      return (
        `Failed to create table "${action.table}". ` +
        `This usually means a column definition has a problem (e.g. invalid foreign key reference, ` +
        `unsupported default value, or a naming conflict). ` +
        `SQLite error: ${rawError}`
      );
    case "add_column":
      return (
        `Failed to add column "${action.column}" to table "${action.table}". ` +
        `Common causes: NOT NULL column without a DEFAULT, or the column already exists ` +
        `with a different definition. SQLite error: ${rawError}`
      );
    case "create_index":
      return (
        `Failed to create index "${action.index}" on table "${action.table}". ` +
        `This usually means a referenced column does not exist, or an index with the ` +
        `same name already exists. SQLite error: ${rawError}`
      );
    case "drop_table":
      return (
        `Failed to drop table "${action.table}". ` +
        `This may mean another table has a foreign key referencing this table. ` +
        `SQLite error: ${rawError}`
      );
    default:
      return `Plugin schema migration failed on action: ${rawError}`;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeIdentifier(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid SQL identifier: "${name}"`);
  }
  return name;
}
