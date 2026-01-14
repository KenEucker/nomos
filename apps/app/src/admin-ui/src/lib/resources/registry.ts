/**
 * Admin Resource Registry
 *
 * Central registry for all admin resources. Resources are registered here
 * and can be looked up by ID for rendering generic CRUD components.
 */

import type { AdminResource } from "./types";

// Import resource definitions
import { usersResource } from "./definitions/users";
import { rolesResource } from "./definitions/roles";
import { sessionsResource } from "./definitions/sessions";
import { apiKeysResource } from "./definitions/api-keys";
import { dashboardResource } from "./definitions/dashboard";
import { auditResource } from "./definitions/audit";
import { errorsResource } from "./definitions/errors";
import { jobsResource } from "./definitions/jobs";
import { webhooksResource } from "./definitions/webhooks";
import { routesResource } from "./definitions/routes";
import { diagnosticsResource } from "./definitions/diagnostics";
import { docsResource } from "./definitions/docs";
import { loginResource } from "./definitions/login";

/**
 * Map of all registered resources
 */
const resourceMap = new Map<string, AdminResource>();

/**
 * Register a resource
 */
export function registerResource(resource: AdminResource): void {
  resourceMap.set(resource.id, resource);
}

/**
 * Get a resource by ID
 */
export function getResource(id: string): AdminResource | undefined {
  return resourceMap.get(id);
}

/**
 * Get all registered resources
 */
export function getAllResources(): AdminResource[] {
  return Array.from(resourceMap.values());
}

/**
 * Get resources for navigation (those with nav enabled)
 */
export function getNavResources(): AdminResource[] {
  return getAllResources().filter((r) => r.actions?.view !== false);
}

/**
 * Check if a resource exists
 */
export function hasResource(id: string): boolean {
  return resourceMap.has(id);
}

// Register all resources
registerResource(usersResource);
registerResource(rolesResource);
registerResource(sessionsResource);
registerResource(apiKeysResource);
registerResource(dashboardResource);
registerResource(auditResource);
registerResource(errorsResource);
registerResource(jobsResource);
registerResource(webhooksResource);
registerResource(routesResource);
registerResource(diagnosticsResource);
registerResource(docsResource);
registerResource(loginResource);

// Export all resources for direct access
export {
  usersResource,
  rolesResource,
  sessionsResource,
  apiKeysResource,
  dashboardResource,
  auditResource,
  errorsResource,
  jobsResource,
  webhooksResource,
  routesResource,
  diagnosticsResource,
  docsResource,
  loginResource,
};
