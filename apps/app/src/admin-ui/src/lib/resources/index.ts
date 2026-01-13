/**
 * Admin Resource Framework
 *
 * This module provides the resource definition system for the admin UI.
 * Import resources and utilities from here.
 */

// Export types
export type {
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
export { resolveEndpoint, getFieldByName, getFieldsForView } from "./types";

// Export registry functions
export {
  registerResource,
  getResource,
  getAllResources,
  getNavResources,
  hasResource
} from "./registry";

// Export individual resources
export { usersResource } from "./definitions/users";
export { rolesResource } from "./definitions/roles";
export { sessionsResource } from "./definitions/sessions";
export { apiKeysResource } from "./definitions/api-keys";
