/**
 * Plugin Database Schema — Types only
 *
 * manifest.database (PluginDatabaseDefinition) is converted to Prisma schema
 * and merged via the schema merger + PrismaManager. This module re-exports types
 * for the manifest shape.
 */

export type {
  PluginDatabaseDefinition,
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
