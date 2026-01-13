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

// Export all resources for direct access
export { usersResource, rolesResource, sessionsResource, apiKeysResource };
