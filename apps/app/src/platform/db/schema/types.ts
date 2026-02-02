/**
 * Schema merger types for parsing and merging Prisma schema.
 * Used for runtime plugin schema composition.
 */

/** A single field or model-level directive in a Prisma model (raw line(s)). */
export type ParsedField = {
  /** Field name (e.g. "id", "userId") or "" for @@ directives. */
  name: string;
  /** Full line(s) as in the schema, for faithful emission. */
  raw: string;
};

/** A parsed Prisma model. */
export type ParsedModel = {
  name: string;
  fields: ParsedField[];
  /** Optional comment block immediately before the model. */
  comment?: string;
};

/** Top-level block: datasource, generator, or model. */
export type ParsedBlock = {
  kind: "datasource" | "generator" | "model";
  /** Block name (e.g. "db", "client", "User"). */
  name: string;
  /** Full raw content including block header and braces. */
  raw: string;
  /** Parsed model (only when kind === "model"). */
  model?: ParsedModel;
};

/** Result of parsing a full schema. */
export type ParsedSchema = {
  datasource: ParsedBlock | null;
  generator: ParsedBlock | null;
  models: Map<string, ParsedModel>;
};

/** Origin of a model or field (for conflict reporting). */
export type SchemaOrigin = "core" | string; // string = plugin slug

/** Merge result with origin tracking for debugging. */
export type MergeResult = {
  models: Map<string, ParsedModel>;
  /** model name -> origin (core or plugin slug). */
  modelOrigin: Map<string, SchemaOrigin>;
  /** "modelName.fieldName" -> origin. */
  fieldOrigin: Map<string, SchemaOrigin>;
};

/** Preview of schema changes for admin. */
export type SchemaPreview = {
  tablesAdded: string[];
  columnsAdded: Array<{ model: string; field: string; type: string; plugin: string }>;
  warnings: string[];
};
