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
export { dashboardResource } from "./definitions/dashboard";
export { auditResource } from "./definitions/audit";
export { errorsResource } from "./definitions/errors";
export { jobsResource } from "./definitions/jobs";
export { webhooksResource } from "./definitions/webhooks";
export { routesResource } from "./definitions/routes";
export { diagnosticsResource } from "./definitions/diagnostics";
export { docsResource } from "./definitions/docs";
export { loginResource } from "./definitions/login";
