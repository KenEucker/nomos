/**
 * Admin Resource Framework
 *
 * This module provides the resource definition system for the admin UI.
 * Import resources and utilities from here.
 */

// Export types
export type {
  AdminResourceInput,
  AdminResource,
  FieldDef,
  FieldType,
  ColumnDef,
  FilterDef,
  ResourceActions,
  BaseFieldDef,
  TextFieldDef,
  NumberFieldDef,
  TextareaFieldDef,
  EnumFieldDef,
  JsonFieldDef,
  RelationFieldDef,
  RelationManyFieldDef
} from "./types";

// Export utility functions
export { normalizeResource, resolveEndpoint, getFieldByName, getFieldsForView } from "./types";
