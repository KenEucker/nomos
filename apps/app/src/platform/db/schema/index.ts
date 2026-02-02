/**
 * Schema merger: public API for runtime plugin Prisma schema composition.
 */

export { mergeSchemas, getMergedSchemaContent, previewSchemaChanges } from "./schema-merger.js";
export type { SchemaMergerOptions, SchemaPreview } from "./schema-merger.js";
export type { MergeResult, ParsedModel, ParsedSchema } from "./types.js";
