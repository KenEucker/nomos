/**
 * Nomos Permission Seeder
 *
 * Auto-discovers and seeds permissions from plugins and core modules.
 * Runs on platform startup to ensure all declared intents exist in the database.
 *
 * Uses raw SQL to handle Prisma client/schema mismatch during migrations.
 */

import type { PrismaClient } from "@prisma/client"
import { randomUUID } from "crypto"

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
// Schema Detection
// =============================================================================

interface TableInfo {
  name: string
}

/**
 * Check if the new authz tables exist in the database.
 */
async function hasAuthzTables(prisma: PrismaClient): Promise<boolean> {
  try {
    const tables = await prisma.$queryRaw<TableInfo[]>`
      SELECT name FROM sqlite_master WHERE type='table' AND name='Permission'
    `
    return tables.length > 0
  } catch {
    return false
  }
}

// =============================================================================
// Database Seeding (Raw SQL)
// =============================================================================

/**
 * Ensure all intents exist in the permissions table using raw SQL.
 */
export async function ensurePermissions(
  prisma: PrismaClient,
  intents: string[]
): Promise<{ created: string[]; existing: string[] }> {
  const created: string[] = []
  const existing: string[] = []

  for (const key of intents) {
    try {
      // Check if permission exists
      const existingPerm = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM Permission WHERE key = ${key}
      `

      if (existingPerm.length === 0) {
        // Create new permission
        const id = randomUUID()
        const now = new Date()
        await prisma.$executeRaw`
          INSERT INTO Permission (id, key, createdAt, updatedAt)
          VALUES (${id}, ${key}, ${now}, ${now})
        `
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
 * Ensure default roles exist with their permissions using raw SQL.
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
      // Check if role exists
      const existingRole = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM Role WHERE key = ${roleData.key}
      `

      let roleId: string

      if (existingRole.length === 0) {
        // Create new role
        roleId = randomUUID()
        const now = new Date()
        await prisma.$executeRaw`
          INSERT INTO Role (id, key, name, description, createdAt, updatedAt)
          VALUES (${roleId}, ${roleData.key}, ${roleData.name}, ${roleData.description ?? null}, ${now}, ${now})
        `
      } else {
        roleId = existingRole[0].id
        // Update existing role
        const now = new Date()
        await prisma.$executeRaw`
          UPDATE Role SET name = ${roleData.name}, description = ${roleData.description ?? null}, updatedAt = ${now}
          WHERE id = ${roleId}
        `
      }

      // Get all permission IDs for this role
      const permissions = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM Permission WHERE key IN (${roleData.permissions.join("','")})
      `

      // This query approach doesn't work well with arrays in raw SQL
      // Let's query permissions one by one
      const permissionIds: string[] = []
      for (const permKey of roleData.permissions) {
        const perm = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM Permission WHERE key = ${permKey}
        `
        if (perm.length > 0) {
          permissionIds.push(perm[0].id)
        }
      }

      // Clear existing role permissions
      await prisma.$executeRaw`DELETE FROM RolePermission WHERE roleId = ${roleId}`

      // Create new role permissions
      for (const permissionId of permissionIds) {
        await prisma.$executeRaw`
          INSERT OR IGNORE INTO RolePermission (roleId, permissionId)
          VALUES (${roleId}, ${permissionId})
        `
      }
    } catch (error) {
      console.error(`[authz] Failed to ensure role "${roleData.key}":`, error)
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

  // Check if authz tables exist
  const tablesExist = await hasAuthzTables(prisma)
  if (!tablesExist) {
    console.log("[authz] Authorization tables not found. Skipping seeding.")
    console.log("[authz] Run 'npx prisma migrate dev' to create the tables.")
    return
  }

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
