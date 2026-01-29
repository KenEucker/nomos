/**
 * Plugin Schema Validator
 *
 * Validates a PluginDatabaseDefinition before any SQL is generated or executed.
 * Produces detailed, actionable error messages so plugin developers can debug
 * their schema definitions without guessing what went wrong.
 */

import type {
  PluginDatabaseDefinition,
  TableDefinition,
  ColumnDefinition,
  ColumnType,
  IndexDefinition,
  ValidationIssue,
  ValidationResult,
} from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_COLUMN_TYPES: Set<ColumnType> = new Set([
  "text",
  "integer",
  "real",
  "boolean",
  "datetime",
  "json",
]);

const VALID_ON_DELETE: Set<string> = new Set([
  "cascade",
  "set null",
  "restrict",
  "no action",
]);

/** Core platform tables that plugins must not shadow or reference incorrectly. */
const CORE_TABLES: Set<string> = new Set([
  "User",
  "Role",
  "Permission",
  "RolePermission",
  "UserRole",
  "SubjectRole",
  "Session",
  "ApiKey",
  "PluginState",
]);

/** Names that would collide with SQL keywords or internal conventions. */
const RESERVED_NAMES: Set<string> = new Set([
  "select",
  "insert",
  "update",
  "delete",
  "drop",
  "create",
  "alter",
  "table",
  "index",
  "from",
  "where",
  "order",
  "group",
  "having",
  "limit",
  "offset",
  "join",
  "on",
  "as",
  "and",
  "or",
  "not",
  "null",
  "true",
  "false",
  "primary",
  "key",
  "foreign",
  "references",
  "constraint",
  "unique",
  "default",
  "check",
  "autoincrement",
  "rowid",
  "integer",
  "text",
  "real",
  "blob",
  "pragma",
]);

/** Identifier pattern: lowercase letters, digits, underscores. Must start with letter. */
const IDENTIFIER_RE = /^[a-z][a-z0-9_]*$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const issue = (
  severity: "error" | "warning",
  code: string,
  message: string,
  location?: { table?: string; column?: string; index?: string }
): ValidationIssue => ({
  severity,
  code,
  message,
  ...location,
});

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate a plugin's database definition.
 *
 * @param pluginSlug  The plugin's slug (used for namespacing checks).
 * @param definition  The database definition from the plugin manifest.
 * @param knownPluginTables Optional set of already-existing plugin table names
 *                          (fully qualified, e.g. "plugin_other_items") for
 *                          cross-plugin reference validation.
 */
export function validatePluginSchema(
  pluginSlug: string,
  definition: PluginDatabaseDefinition,
  knownPluginTables?: Set<string>
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Top-level checks
  if (!definition || typeof definition !== "object") {
    issues.push(issue("error", "INVALID_DEFINITION", "database must be an object."));
    return { valid: false, issues };
  }

  if (!definition.tables || typeof definition.tables !== "object") {
    issues.push(issue("error", "MISSING_TABLES", "database.tables must be an object."));
    return { valid: false, issues };
  }

  const tableNames = Object.keys(definition.tables);
  if (tableNames.length === 0) {
    issues.push(issue("warning", "EMPTY_TABLES", "database.tables is empty. No tables will be created."));
    return { valid: true, issues };
  }

  // Collect qualified table names for this plugin (for self-referencing foreign keys)
  const qualifiedNames = new Set<string>(
    tableNames.map((t) => qualifyTableName(pluginSlug, t))
  );
  // Also allow short names for self-references
  const shortNames = new Set<string>(tableNames);

  for (const [tableName, tableDef] of Object.entries(definition.tables)) {
    validateTableName(tableName, pluginSlug, issues);
    validateTable(
      tableName,
      tableDef,
      pluginSlug,
      shortNames,
      qualifiedNames,
      knownPluginTables ?? new Set(),
      issues
    );
  }

  const hasErrors = issues.some((i) => i.severity === "error");
  return { valid: !hasErrors, issues };
}

// ---------------------------------------------------------------------------
// Table Name Validation
// ---------------------------------------------------------------------------

function validateTableName(
  name: string,
  pluginSlug: string,
  issues: ValidationIssue[]
): void {
  if (!IDENTIFIER_RE.test(name)) {
    issues.push(
      issue("error", "INVALID_TABLE_NAME", `Table "${name}": name must match /^[a-z][a-z0-9_]*$/ (lowercase, start with letter).`, { table: name })
    );
  }

  if (RESERVED_NAMES.has(name.toLowerCase())) {
    issues.push(
      issue("error", "RESERVED_TABLE_NAME", `Table "${name}": name is a reserved SQL keyword.`, { table: name })
    );
  }

  const qualified = qualifyTableName(pluginSlug, name);
  if (qualified.length > 63) {
    issues.push(
      issue("warning", "LONG_TABLE_NAME", `Table "${name}": qualified name "${qualified}" exceeds 63 characters. This may cause issues with some databases.`, { table: name })
    );
  }

  // Check the table name doesn't collide with a core table
  if (CORE_TABLES.has(name) || CORE_TABLES.has(qualified)) {
    issues.push(
      issue("error", "CORE_TABLE_COLLISION", `Table "${name}": collides with core platform table "${name}". Choose a different name.`, { table: name })
    );
  }
}

// ---------------------------------------------------------------------------
// Table Structure Validation
// ---------------------------------------------------------------------------

function validateTable(
  tableName: string,
  tableDef: TableDefinition,
  pluginSlug: string,
  shortNames: Set<string>,
  qualifiedNames: Set<string>,
  knownPluginTables: Set<string>,
  issues: ValidationIssue[]
): void {
  if (!tableDef || typeof tableDef !== "object") {
    issues.push(issue("error", "INVALID_TABLE", `Table "${tableName}": must be an object.`, { table: tableName }));
    return;
  }

  if (!tableDef.columns || typeof tableDef.columns !== "object") {
    issues.push(issue("error", "MISSING_COLUMNS", `Table "${tableName}": must have a columns object.`, { table: tableName }));
    return;
  }

  const columnNames = Object.keys(tableDef.columns);
  if (columnNames.length === 0) {
    issues.push(issue("error", "EMPTY_COLUMNS", `Table "${tableName}": must have at least one column.`, { table: tableName }));
    return;
  }

  // Validate each column
  let primaryKeyCount = 0;
  for (const [colName, colDef] of Object.entries(tableDef.columns)) {
    validateColumnName(colName, tableName, issues);
    validateColumn(colName, colDef, tableName, pluginSlug, shortNames, qualifiedNames, knownPluginTables, issues);
    if (colDef.primaryKey) primaryKeyCount++;
  }

  // Exactly one primary key
  if (primaryKeyCount === 0) {
    issues.push(
      issue("error", "NO_PRIMARY_KEY", `Table "${tableName}": must have exactly one column with primaryKey: true.`, { table: tableName })
    );
  }
  if (primaryKeyCount > 1) {
    issues.push(
      issue("error", "MULTIPLE_PRIMARY_KEYS", `Table "${tableName}": has ${primaryKeyCount} primary key columns. Only one is allowed.`, { table: tableName })
    );
  }

  // Validate indexes
  if (tableDef.indexes) {
    if (!Array.isArray(tableDef.indexes)) {
      issues.push(issue("error", "INVALID_INDEXES", `Table "${tableName}": indexes must be an array.`, { table: tableName }));
    } else {
      const indexNames = new Set<string>();
      for (let i = 0; i < tableDef.indexes.length; i++) {
        validateIndex(tableDef.indexes[i], i, tableName, columnNames, indexNames, pluginSlug, issues);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Column Validation
// ---------------------------------------------------------------------------

function validateColumnName(
  name: string,
  tableName: string,
  issues: ValidationIssue[]
): void {
  if (!IDENTIFIER_RE.test(name)) {
    issues.push(
      issue("error", "INVALID_COLUMN_NAME", `Table "${tableName}", column "${name}": name must match /^[a-z][a-z0-9_]*$/.`, { table: tableName, column: name })
    );
  }

  if (RESERVED_NAMES.has(name.toLowerCase())) {
    issues.push(
      issue("error", "RESERVED_COLUMN_NAME", `Table "${tableName}", column "${name}": name is a reserved SQL keyword.`, { table: tableName, column: name })
    );
  }
}

function validateColumn(
  colName: string,
  colDef: ColumnDefinition,
  tableName: string,
  pluginSlug: string,
  shortNames: Set<string>,
  qualifiedNames: Set<string>,
  knownPluginTables: Set<string>,
  issues: ValidationIssue[]
): void {
  const loc = { table: tableName, column: colName };

  if (!colDef || typeof colDef !== "object") {
    issues.push(issue("error", "INVALID_COLUMN", `Table "${tableName}", column "${colName}": must be an object.`, loc));
    return;
  }

  // Type check
  if (!colDef.type) {
    issues.push(issue("error", "MISSING_TYPE", `Table "${tableName}", column "${colName}": missing "type" property.`, loc));
  } else if (!VALID_COLUMN_TYPES.has(colDef.type)) {
    issues.push(
      issue(
        "error",
        "INVALID_TYPE",
        `Table "${tableName}", column "${colName}": type "${colDef.type}" is not valid. Use one of: ${[...VALID_COLUMN_TYPES].join(", ")}.`,
        loc
      )
    );
  }

  // Primary key constraints
  if (colDef.primaryKey) {
    if (colDef.nullable) {
      issues.push(
        issue("error", "NULLABLE_PRIMARY_KEY", `Table "${tableName}", column "${colName}": primary key cannot be nullable.`, loc)
      );
    }
  }

  // Default value checks
  if (colDef.default !== undefined) {
    validateDefault(colDef.default, colDef.type, colName, tableName, issues);
  }

  // Nullable + NOT NULL check
  if (colDef.nullable === true && colDef.default === undefined && !colDef.primaryKey) {
    // This is fine - nullable column with no default gets NULL
  }

  // Foreign key reference validation
  if (colDef.references) {
    validateReference(colDef.references, colName, tableName, pluginSlug, shortNames, qualifiedNames, knownPluginTables, issues);
  }

  // set null requires nullable
  if (colDef.references?.onDelete === "set null" && !colDef.nullable) {
    issues.push(
      issue(
        "error",
        "SET_NULL_NOT_NULLABLE",
        `Table "${tableName}", column "${colName}": onDelete "set null" requires nullable: true.`,
        loc
      )
    );
  }
}

function validateDefault(
  value: unknown,
  type: ColumnType,
  colName: string,
  tableName: string,
  issues: ValidationIssue[]
): void {
  const loc = { table: tableName, column: colName };

  if (value === "cuid" || value === "uuid") {
    if (type !== "text") {
      issues.push(
        issue("error", "DEFAULT_TYPE_MISMATCH", `Table "${tableName}", column "${colName}": default "${value}" requires type "text".`, loc)
      );
    }
    return;
  }

  if (value === "now") {
    if (type !== "datetime") {
      issues.push(
        issue("error", "DEFAULT_TYPE_MISMATCH", `Table "${tableName}", column "${colName}": default "now" requires type "datetime".`, loc)
      );
    }
    return;
  }

  // Literal defaults
  if (typeof value === "string" && type !== "text" && type !== "json") {
    issues.push(
      issue("warning", "DEFAULT_TYPE_MISMATCH", `Table "${tableName}", column "${colName}": string default on non-text column.`, loc)
    );
  }
  if (typeof value === "number" && type !== "integer" && type !== "real") {
    issues.push(
      issue("warning", "DEFAULT_TYPE_MISMATCH", `Table "${tableName}", column "${colName}": number default on non-numeric column.`, loc)
    );
  }
  if (typeof value === "boolean" && type !== "boolean") {
    issues.push(
      issue("warning", "DEFAULT_TYPE_MISMATCH", `Table "${tableName}", column "${colName}": boolean default on non-boolean column.`, loc)
    );
  }
}

function validateReference(
  ref: NonNullable<ColumnDefinition["references"]>,
  colName: string,
  tableName: string,
  pluginSlug: string,
  shortNames: Set<string>,
  qualifiedNames: Set<string>,
  knownPluginTables: Set<string>,
  issues: ValidationIssue[]
): void {
  const loc = { table: tableName, column: colName };

  if (!ref.table || !ref.column) {
    issues.push(
      issue("error", "INCOMPLETE_REFERENCE", `Table "${tableName}", column "${colName}": references must have both "table" and "column".`, loc)
    );
    return;
  }

  if (ref.onDelete && !VALID_ON_DELETE.has(ref.onDelete)) {
    issues.push(
      issue("error", "INVALID_ON_DELETE", `Table "${tableName}", column "${colName}": onDelete "${ref.onDelete}" is not valid. Use: cascade, set null, restrict, no action.`, loc)
    );
  }

  // Determine if the reference target is valid
  const isCoreTable = CORE_TABLES.has(ref.table);
  const isSelfTable = shortNames.has(ref.table) || qualifiedNames.has(ref.table);
  const isOtherPlugin = knownPluginTables.has(ref.table);

  if (!isCoreTable && !isSelfTable && !isOtherPlugin) {
    // Build a helpful message
    const qualified = qualifyTableName(pluginSlug, ref.table);
    const suggestions: string[] = [];
    if (shortNames.has(ref.table)) suggestions.push(`"${ref.table}" (this plugin)`);
    if (CORE_TABLES.has(ref.table)) suggestions.push(`"${ref.table}" (core table)`);

    issues.push(
      issue(
        "error",
        "UNKNOWN_REFERENCE_TABLE",
        `Table "${tableName}", column "${colName}": references table "${ref.table}" which is not a core table, not in this plugin, and not a known plugin table. ` +
          `Core tables: ${[...CORE_TABLES].join(", ")}. ` +
          `This plugin's tables: ${[...shortNames].join(", ")}.` +
          (suggestions.length > 0 ? ` Did you mean: ${suggestions.join(" or ")}?` : ""),
        loc
      )
    );
  }
}

// ---------------------------------------------------------------------------
// Index Validation
// ---------------------------------------------------------------------------

function validateIndex(
  indexDef: IndexDefinition,
  position: number,
  tableName: string,
  columnNames: string[],
  usedNames: Set<string>,
  pluginSlug: string,
  issues: ValidationIssue[]
): void {
  if (!indexDef || typeof indexDef !== "object") {
    issues.push(
      issue("error", "INVALID_INDEX", `Table "${tableName}", index [${position}]: must be an object.`, { table: tableName })
    );
    return;
  }

  if (!Array.isArray(indexDef.columns) || indexDef.columns.length === 0) {
    issues.push(
      issue("error", "EMPTY_INDEX_COLUMNS", `Table "${tableName}", index [${position}]: columns must be a non-empty array.`, { table: tableName })
    );
    return;
  }

  // Check all referenced columns exist
  for (const col of indexDef.columns) {
    if (!columnNames.includes(col)) {
      issues.push(
        issue(
          "error",
          "INDEX_UNKNOWN_COLUMN",
          `Table "${tableName}", index [${position}]: references column "${col}" which does not exist. Available columns: ${columnNames.join(", ")}.`,
          { table: tableName, column: col }
        )
      );
    }
  }

  // Check for duplicate index names
  const name = indexDef.name ?? generateIndexName(pluginSlug, tableName, indexDef.columns, indexDef.unique);
  if (usedNames.has(name)) {
    issues.push(
      issue("error", "DUPLICATE_INDEX_NAME", `Table "${tableName}", index [${position}]: name "${name}" is already used.`, { table: tableName, index: name })
    );
  }
  usedNames.add(name);
}

// ---------------------------------------------------------------------------
// Naming Helpers
// ---------------------------------------------------------------------------

/** Convert a short table name to the fully qualified name stored in the database. */
export function qualifyTableName(pluginSlug: string, shortName: string): string {
  return `plugin_${pluginSlug}_${shortName}`;
}

/** Generate a deterministic index name. */
export function generateIndexName(
  pluginSlug: string,
  tableName: string,
  columns: string[],
  unique?: boolean
): string {
  const prefix = unique ? "ux" : "ix";
  return `${prefix}_plugin_${pluginSlug}_${tableName}_${columns.join("_")}`;
}
