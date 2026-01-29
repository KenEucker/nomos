/**
 * Plugin Database Schema — Public API
 *
 * This module is the single entry point for the plugin database system.
 * It exposes high-level functions that the plugin lifecycle (install,
 * preview, enable, disable, uninstall) calls at each stage.
 *
 * Architecture:
 *
 *   Plugin Manifest
 *        │
 *        ▼
 *   ┌──────────┐    ┌─────────────┐    ┌──────────┐    ┌─────────┐
 *   │ validate  │───▶│ introspect  │───▶│   diff   │───▶│ migrate │
 *   └──────────┘    └─────────────┘    └──────────┘    └─────────┘
 *                                                            │
 *                                                            ▼
 *                                                     ┌───────────┐
 *                                                     │   query   │
 *                                                     └───────────┘
 *
 *   validate   — Check the schema definition for errors before any DB access.
 *   introspect — Read the actual DB state via PRAGMA.
 *   diff       — Compare desired vs. actual, produce a migration plan.
 *   migrate    — Apply the plan (CREATE TABLE, ALTER TABLE, etc.).
 *   query      — CRUD operations for plugin tables at runtime.
 */

import type { PrismaClient } from "@prisma/client";
import type {
  PluginDatabaseDefinition,
  PluginDbClient,
  ValidationResult,
  SchemaDiffResult,
} from "./types";
import { validatePluginSchema } from "./validate";
import { computeSchemaDiff, computeDropDiff } from "./diff";
import { applyMigration, verifyMigration, type MigrationResult } from "./migrate";
import { createPluginDbClient } from "./query";
import { listPluginTables } from "./introspect";

// ---------------------------------------------------------------------------
// Re-exports for consumers
// ---------------------------------------------------------------------------

export type {
  PluginDatabaseDefinition,
  PluginDbClient,
  TableDefinition,
  ColumnDefinition,
  ColumnType,
  ColumnDefault,
  ColumnReference,
  IndexDefinition,
  ValidationResult,
  ValidationIssue,
  SchemaDiffResult,
  SchemaAction,
} from "./types";

export type { MigrationResult } from "./migrate";

// ---------------------------------------------------------------------------
// High-Level API
// ---------------------------------------------------------------------------

/**
 * Validate a plugin's database definition.
 *
 * Call during: discovery / install (before any SQL).
 * This is a pure function — no database access required.
 */
export function validateSchema(
  pluginSlug: string,
  definition: PluginDatabaseDefinition,
  knownPluginTables?: Set<string>
): ValidationResult {
  return validatePluginSchema(pluginSlug, definition, knownPluginTables);
}

/**
 * Preview what database changes a plugin would make.
 *
 * Call during: preview step.
 * Reads the database (introspection) but does NOT write anything.
 *
 * @returns A diff result with human-readable summaries and warnings.
 */
export async function previewSchema(
  prisma: PrismaClient,
  pluginSlug: string,
  definition: PluginDatabaseDefinition
): Promise<SchemaDiffResult> {
  return computeSchemaDiff(prisma, pluginSlug, definition);
}

/**
 * Apply a plugin's database schema to the live database.
 *
 * Call during: enable step.
 * Computes the diff and applies it within a transaction.
 *
 * The full flow is:
 *   1. Validate the schema definition.
 *   2. Compute the diff against the current database state.
 *   3. Apply the diff within a transaction.
 *   4. Verify the migration succeeded.
 *
 * @returns Migration result with success/failure details.
 */
export async function applySchema(
  prisma: PrismaClient,
  pluginSlug: string,
  definition: PluginDatabaseDefinition
): Promise<{ validation: ValidationResult; diff: SchemaDiffResult; migration: MigrationResult }> {
  // Step 1: Validate
  const knownTables = new Set(await listPluginTables(prisma));
  const validation = validatePluginSchema(pluginSlug, definition, knownTables);
  if (!validation.valid) {
    return {
      validation,
      diff: { actions: [], summary: [], warnings: [], hasChanges: false },
      migration: {
        success: false,
        applied: [],
        error: `Schema validation failed with ${validation.issues.filter((i) => i.severity === "error").length} error(s). Fix the schema definition before enabling.`,
        warnings: validation.issues
          .filter((i) => i.severity === "warning")
          .map((i) => i.message),
      },
    };
  }

  // Step 2: Compute diff
  const diff = await computeSchemaDiff(prisma, pluginSlug, definition);
  if (!diff.hasChanges) {
    return {
      validation,
      diff,
      migration: { success: true, applied: [], warnings: diff.warnings },
    };
  }

  // Step 3: Apply
  const migration = await applyMigration(prisma, diff);

  // Step 4: Verify (if migration reported success)
  if (migration.success) {
    const verification = await verifyMigration(prisma, diff);
    if (!verification.verified) {
      migration.success = false;
      migration.error =
        `Migration reported success but verification failed. ` +
        `Missing tables: [${verification.missingTables.join(", ")}]. ` +
        `Missing columns: [${verification.missingColumns.join(", ")}].`;
    }
  }

  return { validation, diff, migration };
}

/**
 * Remove all database tables for a plugin.
 *
 * Call during: uninstall step (only when explicitly requested).
 * Drops tables in reverse order to respect foreign key dependencies.
 *
 * @returns Migration result.
 */
export async function removeSchema(
  prisma: PrismaClient,
  pluginSlug: string
): Promise<{ diff: SchemaDiffResult; migration: MigrationResult }> {
  const diff = await computeDropDiff(prisma, pluginSlug);
  if (!diff.hasChanges) {
    return {
      diff,
      migration: { success: true, applied: [], warnings: [] },
    };
  }

  const migration = await applyMigration(prisma, diff);
  return { diff, migration };
}

/**
 * Create a scoped query client for a plugin's tables.
 *
 * Call during: route handler execution (injected into ctx.pluginDb).
 * The returned client automatically qualifies table names and validates
 * column references against the plugin's schema definition.
 */
export function createDbClient(
  prisma: PrismaClient,
  pluginSlug: string,
  definition: PluginDatabaseDefinition
): PluginDbClient {
  return createPluginDbClient(prisma, pluginSlug, definition);
}
