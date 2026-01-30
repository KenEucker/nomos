/**
 * Nomos Permission Seeder
 *
 * Auto-discovers and seeds permissions from plugins, core modules, and API contracts.
 * Runs on platform startup to ensure all declared intents exist in the database.
 */

import type { PrismaClient } from "@prisma/client"
import { getLoadedIntents } from "../router/loadRoutes"

// =============================================================================
// Intent Collection
// =============================================================================

/**
 * Core platform intents that are always available.
 */
export const CORE_INTENTS = [
  // Admin access
  "admin.access",
  "admin.read",
  "admin.diagnostics",

  // Role management
  "roles.list",
  "roles.read",
  "roles.create",
  "roles.update",
  "roles.delete",
  "roles.manage",

  // Permission management (read-only in admin)
  "permissions.read",

  // Subject management (user/apiKey role assignment)
  "subjects.read",
  "subjects.update",

  // API Key management
  "apiKeys.list",
  "apiKeys.read",
  "apiKeys.create",
  "apiKeys.update",
  "apiKeys.delete",

  // Debug/diagnostics
  "debug.decisions.view",

  // Webhooks and jobs
  "webhooks.manage",
  "jobs.manage",

  // Auth management
  "auth.manage",

  // Plugin management
  "plugins.manage",

  // SDK access
  "sdk.read",
  "sdk.write",

  // User management
  "users.list",
  "users.read",
  "users.create",
  "users.update",
  "users.delete",
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
      const existingPerm = await prisma.permission.findUnique({
        where: { key },
      })

      if (!existingPerm) {
        await prisma.permission.create({
          data: { key },
        })
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
    try {
      // Upsert role
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

      // Clear existing role permissions
      await prisma.rolePermission.deleteMany({
        where: { roleId: role.id },
      })

      // Create new role permissions
      if (permissions.length > 0) {
        await prisma.rolePermission.createMany({
          data: permissions.map((perm) => ({
            roleId: role.id,
            permissionId: perm.id,
          })),
        })
      }
    } catch (error) {
      console.error(`[authz] Failed to ensure role "${roleData.key}":`, error)
    }
  }
}

/**
 * Ensure admin users have SubjectRole entries for the admin role.
 */
export async function ensureAdminSubjectRoles(prisma: PrismaClient): Promise<void> {
  try {
    // Find the admin role
    const adminRole = await prisma.role.findUnique({
      where: { key: "admin" },
    })

    if (!adminRole) {
      console.log("[authz] Admin role not found, skipping subject role assignment")
      return
    }

    // Find all users with admin or platform_admin role via UserRole
    const adminUserRoles = await prisma.userRole.findMany({
      where: {
        role: {
          key: { in: ["admin", "platform_admin"] },
        },
      },
      include: { user: true },
    })

    // Create SubjectRole entries for each admin user
    for (const userRole of adminUserRoles) {
      try {
        await prisma.subjectRole.upsert({
          where: {
            subjectType_subjectId_roleId: {
              subjectType: "user",
              subjectId: userRole.user.id,
              roleId: adminRole.id,
            },
          },
          create: {
            subjectType: "user",
            subjectId: userRole.user.id,
            roleId: adminRole.id,
          },
          update: {},
        })
      } catch {
        // Ignore duplicate errors
      }
    }

    console.log(`[authz] Ensured ${adminUserRoles.length} admin users have SubjectRole entries`)
  } catch (error) {
    console.error("[authz] Failed to ensure admin subject roles:", error)
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
    "admin.read",
    "roles.list",
    "roles.read",
    "permissions.read",
    "subjects.read",
    "apiKeys.list",
    "apiKeys.read",
    "users.list",
    "users.read",
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
    "admin.read",
    "roles.list",
    "roles.read",
    "permissions.read",
    "subjects.read",
    "subjects.update",
    "apiKeys.list",
    "apiKeys.read",
    "apiKeys.create",
    "apiKeys.update",
    "users.list",
    "users.read",
    "users.create",
    "users.update",
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
  /** Include intents discovered from API contracts (call after loadRoutes) */
  includeContractIntents?: boolean
}

/**
 * Run the full permission seeding process.
 * Call this during platform startup.
 */
export async function seedAuthzDatabase(options: SeederOptions): Promise<void> {
  const {
    prisma,
    plugins = [],
    additionalIntents = [],
    seedDefaultRoles = true,
    includeContractIntents = true,
  } = options

  console.log("[authz] Seeding authorization database...")

  // Collect all intents
  const allIntents = new Set<string>([
    ...CORE_INTENTS,
    ...collectIntentsFromPlugins(plugins),
    ...additionalIntents,
  ])

  // Collect intents from loaded API contracts
  if (includeContractIntents) {
    const contractIntents = getLoadedIntents()
    for (const intent of contractIntents) {
      allIntents.add(intent)
    }
    if (contractIntents.length > 0) {
      console.log(`[authz] Discovered ${contractIntents.length} intents from API contracts`)
    }
  }

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
    // SubjectRole is not used for authz; user grants come from UserRole. ensureAdminSubjectRoles omitted.
  }

  console.log("[authz] Authorization database seeding complete")
}
