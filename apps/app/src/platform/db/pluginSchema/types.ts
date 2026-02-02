/**
 * Plugin Database Schema Types
 *
 * Plugins define their database requirements using these types.
 * The platform validates, diffs, and applies schema changes at runtime
 * without requiring Prisma codegen or server restarts.
 *
 * Table naming: all plugin tables are stored as `plugin_{slug}_{tableName}`
 * to prevent collisions between plugins and with core platform tables.
 */

// ---------------------------------------------------------------------------
// Column Types
// ---------------------------------------------------------------------------

/** Supported SQLite-compatible column types. */
export type ColumnType = "text" | "integer" | "real" | "boolean" | "datetime" | "json";

/** How a default value is generated. */
export type ColumnDefault = "cuid" | "uuid" | "now" | string | number | boolean;

/** Foreign key reference to another table. */
export type ColumnReference = {
  /** Table name. For core tables use the Prisma model name (e.g. "User").
   *  For tables in the same plugin, use the short name (e.g. "posts"). */
  table: string;
  /** Column in the referenced table. */
  column: string;
  /** Action on delete of the referenced row. Defaults to "restrict". */
  onDelete?: "cascade" | "set null" | "restrict" | "no action";
};

/** Full definition of a single column. */
export type ColumnDefinition = {
  /** The storage type. */
  type: ColumnType;
  /** Mark as PRIMARY KEY. At most one column per table. */
  primaryKey?: boolean;
  /** Mark as NOT NULL. Defaults to true (columns are NOT NULL unless nullable is set). */
  nullable?: boolean;
  /** Add a UNIQUE constraint on this column. */
  unique?: boolean;
  /** Default value or generator. */
  default?: ColumnDefault;
  /** Foreign key reference. */
  references?: ColumnReference;
};

// ---------------------------------------------------------------------------
// Index Types
// ---------------------------------------------------------------------------

/** A secondary index on one or more columns. */
export type IndexDefinition = {
  /** Columns included in the index, in order. */
  columns: string[];
  /** Whether the index enforces uniqueness. */
  unique?: boolean;
  /** Optional explicit name. Auto-generated if omitted. */
  name?: string;
};

// ---------------------------------------------------------------------------
// Table Types
// ---------------------------------------------------------------------------

/** Full definition of a single table. */
export type TableDefinition = {
  /** Column definitions keyed by column name. */
  columns: Record<string, ColumnDefinition>;
  /** Secondary indexes (primary key index is implicit). */
  indexes?: IndexDefinition[];
};

// ---------------------------------------------------------------------------
// Plugin Database Manifest
// ---------------------------------------------------------------------------

/** The `database` property on a plugin manifest. */
export type PluginDatabaseDefinition = {
  /** Tables this plugin needs, keyed by short name (no prefix). */
  tables: Record<string, TableDefinition>;
};

// ---------------------------------------------------------------------------
// Introspection Types (actual DB state)
// ---------------------------------------------------------------------------

/** A column as read from the live database via PRAGMA table_info. */
export type IntrospectedColumn = {
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: string | null;
  primaryKey: boolean;
};

/** An index as read from the live database via PRAGMA index_list / index_info. */
export type IntrospectedIndex = {
  name: string;
  columns: string[];
  unique: boolean;
  origin: "c" | "pk" | "u"; // created by CREATE INDEX, PRIMARY KEY, or UNIQUE constraint
};

/** Foreign key as read from PRAGMA foreign_key_list. */
export type IntrospectedForeignKey = {
  fromColumn: string;
  toTable: string;
  toColumn: string;
  onDelete: string;
};

/** Full introspected state of a single table. */
export type IntrospectedTable = {
  name: string;
  columns: IntrospectedColumn[];
  indexes: IntrospectedIndex[];
  foreignKeys: IntrospectedForeignKey[];
};

// ---------------------------------------------------------------------------
// Diff / Migration Plan Types
// ---------------------------------------------------------------------------

export type SchemaAction =
  | { kind: "create_table"; table: string; sql: string }
  | { kind: "add_column"; table: string; column: string; sql: string }
  | { kind: "create_index"; table: string; index: string; sql: string }
  | { kind: "drop_table"; table: string; sql: string };

export type SchemaDiffResult = {
  /** Ordered list of SQL actions to apply. */
  actions: SchemaAction[];
  /** Human-readable summary lines for preview. */
  summary: string[];
  /** Warnings (e.g. column type mismatch that can't be auto-fixed in SQLite). */
  warnings: string[];
  /** Whether any changes are needed. */
  hasChanges: boolean;
};

// ---------------------------------------------------------------------------
// Validation Types
// ---------------------------------------------------------------------------

export type ValidationSeverity = "error" | "warning";

export type ValidationIssue = {
  severity: ValidationSeverity;
  table?: string;
  column?: string;
  index?: string;
  message: string;
  code: string;
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};

