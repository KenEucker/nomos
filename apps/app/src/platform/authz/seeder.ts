/**
 * Nomos Permission Seeder
 *
 * Auto-discovers and seeds permissions from plugins and core modules.
 * Runs on platform startup to ensure all declared intents exist in the database.
 */

import type { PrismaClient } from "@prisma/client"

// =============================================================================
// Intent Collection
// =============================================================================

/**
 * Core platform intents that are always available.
 */
export const CORE_INTENTS = [
  // Admin access
  "admin.access",

  // Role management
  "roles.read",
  "roles.create",
  "roles.update",
  "roles.delete",

  // Permission management (read-only in admin)
  "permissions.read",

  // Subject management (user/apiKey role assignment)
  "subjects.read",
  "subjects.update",

  // API Key management
  "apiKeys.read",
  "apiKeys.create",
  "apiKeys.update",
  "apiKeys.delete",

  // Debug/diagnostics
  "debug.decisions.view",
] as const

export type CoreIntent = (typeof CORE_INTENTS)[number]

/**
 * Collect intents from a plugin definition.
 */
export function collectIntentsFromPlugin(plugin: {
  intents?: string[]
  permissions?: string[] // Legacy support
}): string[] {
  return [...(plugin.intents ?? []), ...(plugin.permissions ?? [])]
}

/**
 * Collect intents from multiple plugins.
 */
export function collectIntentsFromPlugins(
  plugins: Array<{ intents?: string[]; permissions?: string[] }>
): string[] {
  const intents = new Set<string>()

  for (const plugin of plugins) {
    for (const intent of collectIntentsFromPlugin(plugin)) {
      intents.add(intent)
    }
  }

  return Array.from(intents)
}

// =============================================================================
// Database Seeding
// =============================================================================

/**
 * Ensure all intents exist in the permissions table.
 * Uses upsert to avoid duplicates and never deletes existing permissions.
 */
export async function ensurePermissions(
  prisma: PrismaClient,
  intents: string[]
): Promise<{ created: string[]; existing: string[] }> {
  const created: string[] = []
  const existing: string[] = []

  for (const key of intents) {
    try {
      const result = await prisma.permission.upsert({
        where: { key },
        create: { key },
        update: {}, // No-op update to get existing record
      })

      // Check if it was just created (no updatedAt change for new records in same transaction)
      // We'll use a simpler heuristic: if createdAt equals updatedAt, it's new
      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        // This isn't perfect but close enough for logging purposes
        created.push(key)
      } else {
        existing.push(key)
      }
    } catch (error) {
      console.error(`[authz] Failed to ensure permission "${key}":`, error)
    }
  }

  return { created, existing }
}

/**
 * Ensure default roles exist with their permissions.
 */
export async function ensureDefaultRoles(
  prisma: PrismaClient,
  roles: Array<{
    key: string
    name: string
    description?: string
    permissions: string[]
  }>
): Promise<void> {
  for (const roleData of roles) {
    // First, ensure role exists
    const role = await prisma.role.upsert({
      where: { key: roleData.key },
      create: {
        key: roleData.key,
        name: roleData.name,
        description: roleData.description,
      },
      update: {
        name: roleData.name,
        description: roleData.description,
      },
    })

    // Get all permission IDs for this role
    const permissions = await prisma.permission.findMany({
      where: { key: { in: roleData.permissions } },
      select: { id: true },
    })

    // Clear existing role permissions and set new ones
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    })

    if (permissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissions.map((p) => ({
          roleId: role.id,
          permissionId: p.id,
        })),
        skipDuplicates: true,
      })
    }
  }
}

// =============================================================================
// Default Role Definitions
// =============================================================================

/**
 * Default admin role with all core permissions.
 */
export const DEFAULT_ADMIN_ROLE = {
  key: "admin",
  name: "Administrator",
  description: "Full access to all platform features",
  permissions: [...CORE_INTENTS] as string[],
}

/**
 * Default viewer role with read-only access.
 */
export const DEFAULT_VIEWER_ROLE = {
  key: "viewer",
  name: "Viewer",
  description: "Read-only access to platform features",
  permissions: [
    "admin.access",
    "roles.read",
    "permissions.read",
    "subjects.read",
    "apiKeys.read",
  ],
}

/**
 * Default manager role with limited write access.
 */
export const DEFAULT_MANAGER_ROLE = {
  key: "manager",
  name: "Manager",
  description: "Can manage users and view most settings",
  permissions: [
    "admin.access",
    "roles.read",
    "permissions.read",
    "subjects.read",
    "subjects.update",
    "apiKeys.read",
    "apiKeys.create",
    "apiKeys.update",
  ],
}

export const DEFAULT_ROLES = [
  DEFAULT_ADMIN_ROLE,
  DEFAULT_VIEWER_ROLE,
  DEFAULT_MANAGER_ROLE,
]

// =============================================================================
// Startup Seeder
// =============================================================================

export interface SeederOptions {
  prisma: PrismaClient
  plugins?: Array<{ intents?: string[]; permissions?: string[] }>
  additionalIntents?: string[]
  seedDefaultRoles?: boolean
}

/**
 * Run the full permission seeding process.
 * Call this during platform startup.
 */
export async function seedAuthzDatabase(options: SeederOptions): Promise<void> {
  const { prisma, plugins = [], additionalIntents = [], seedDefaultRoles = true } = options

  console.log("[authz] Seeding authorization database...")

  // Collect all intents
  const allIntents = new Set<string>([
    ...CORE_INTENTS,
    ...collectIntentsFromPlugins(plugins),
    ...additionalIntents,
  ])

  // If seeding default roles, include their permissions too
  if (seedDefaultRoles) {
    for (const role of DEFAULT_ROLES) {
      for (const perm of role.permissions) {
        allIntents.add(perm)
      }
    }
  }

  // Ensure all permissions exist
  const { created, existing } = await ensurePermissions(prisma, Array.from(allIntents))

  if (created.length > 0) {
    console.log(`[authz] Created ${created.length} new permissions:`, created)
  }
  console.log(`[authz] Total permissions: ${created.length + existing.length}`)

  // Seed default roles if enabled
  if (seedDefaultRoles) {
    await ensureDefaultRoles(prisma, DEFAULT_ROLES)
    console.log("[authz] Default roles seeded:", DEFAULT_ROLES.map((r) => r.key).join(", "))
  }

  console.log("[authz] Authorization database seeding complete")
}
