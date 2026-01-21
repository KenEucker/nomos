/**
 * Nomos Grant Provider
 *
 * Resolves effective permissions for a subject via database-backed RBAC.
 * Implements per-request memoization and deny-by-default on errors.
 *
 * Uses raw SQL to handle Prisma client/schema mismatch during migrations.
 */

import type { PrismaClient } from "@prisma/client"
import type { Subject, Grants } from "./types"

// =============================================================================
// Grant Provider Interface
// =============================================================================

export interface GrantProvider {
  /**
   * Resolve effective grants (permissions + roles) for a subject.
   * Results are memoized per-request.
   */
  getGrants(subject: Subject): Promise<Grants>

  /**
   * Clear the memoization cache. Call this at the start of each request.
   */
  clearCache(): void
}

// =============================================================================
// Implementation
// =============================================================================

export function createGrantProvider(prisma: PrismaClient): GrantProvider {
  // Per-request memoization cache
  const cache = new Map<string, Promise<Grants>>()

  return {
    async getGrants(subject: Subject): Promise<Grants> {
      const cacheKey = `${subject.type}:${subject.id}`

      // Return cached result if available
      const cached = cache.get(cacheKey)
      if (cached) {
        return cached
      }

      // Resolve grants and cache the promise (not the result)
      // This prevents duplicate queries for the same subject
      const promise = resolveGrants(prisma, subject)
      cache.set(cacheKey, promise)

      return promise
    },

    clearCache(): void {
      cache.clear()
    },
  }
}

// =============================================================================
// Raw SQL Types
// =============================================================================

interface RoleRow {
  roleKey: string
}

interface PermissionRow {
  permissionKey: string
}

// =============================================================================
// Schema Detection
// =============================================================================

/**
 * Check if the SubjectRole table exists.
 */
async function hasSubjectRoleTable(prisma: PrismaClient): Promise<boolean> {
  try {
    const tables = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM sqlite_master WHERE type='table' AND name='SubjectRole'
    `
    return tables.length > 0
  } catch {
    return false
  }
}

// =============================================================================
// Grant Resolution
// =============================================================================

/**
 * Resolve grants for a subject from the database using raw SQL.
 *
 * Query path:
 *   SubjectRole → Role → RolePermission → Permission
 *
 * Returns empty grants on error (deny-by-default).
 */
async function resolveGrants(prisma: PrismaClient, subject: Subject): Promise<Grants> {
  try {
    // Check if new authz tables exist
    const hasNewTables = await hasSubjectRoleTable(prisma)

    if (!hasNewTables) {
      // Fall back to legacy behavior: use UserRole if subject is a user
      if (subject.type === "user") {
        return resolveLegacyUserGrants(prisma, subject)
      }
      // No grants for non-user subjects without new tables
      return { permissions: new Set(), roles: [] }
    }

    // Query roles assigned to this subject
    const roleRows = await prisma.$queryRaw<RoleRow[]>`
      SELECT r.key as roleKey
      FROM SubjectRole sr
      JOIN Role r ON r.id = sr.roleId
      WHERE sr.subjectType = ${subject.type}
        AND sr.subjectId = ${subject.id}
    `

    const roles = roleRows.map((r) => r.roleKey)

    // Query permissions from all assigned roles
    const permissionRows = await prisma.$queryRaw<PermissionRow[]>`
      SELECT DISTINCT p.key as permissionKey
      FROM SubjectRole sr
      JOIN Role r ON r.id = sr.roleId
      JOIN RolePermission rp ON rp.roleId = r.id
      JOIN Permission p ON p.id = rp.permissionId
      WHERE sr.subjectType = ${subject.type}
        AND sr.subjectId = ${subject.id}
    `

    const permissions = new Set<string>(permissionRows.map((p) => p.permissionKey))

    // Check for wildcard permission in claims (for service accounts, etc.)
    if (subject.claims?.permissions) {
      const claimsPermissions = subject.claims.permissions as string[]
      for (const perm of claimsPermissions) {
        permissions.add(perm)
      }
    }

    return { permissions, roles }
  } catch (error) {
    // Log error but return empty grants (deny-by-default)
    console.error("[authz] GrantProvider error:", error)
    return { permissions: new Set(), roles: [] }
  }
}

/**
 * Legacy grant resolution using UserRole table (for backwards compatibility).
 */
async function resolveLegacyUserGrants(prisma: PrismaClient, subject: Subject): Promise<Grants> {
  try {
    // Query roles using legacy UserRole table
    const roleRows = await prisma.$queryRaw<RoleRow[]>`
      SELECT r.key as roleKey
      FROM UserRole ur
      JOIN Role r ON r.id = ur.roleId
      WHERE ur.userId = ${subject.id}
    `

    const roles = roleRows.map((r) => r.roleKey)

    // For legacy mode, derive permissions from role names
    // Admin role gets all permissions
    const permissions = new Set<string>()
    if (roles.includes("admin") || roles.includes("platform_admin")) {
      // Grant all core permissions for admin
      permissions.add("*") // Wildcard permission
    }

    // Check for permissions in claims
    if (subject.claims?.permissions) {
      const claimsPermissions = subject.claims.permissions as string[]
      for (const perm of claimsPermissions) {
        permissions.add(perm)
      }
    }

    return { permissions, roles }
  } catch (error) {
    console.error("[authz] Legacy GrantProvider error:", error)
    return { permissions: new Set(), roles: [] }
  }
}

// =============================================================================
// Request-scoped Factory
// =============================================================================

/**
 * Creates a request-scoped grant provider.
 * The cache is automatically cleared when the provider is created.
 */
export function createRequestScopedGrantProvider(prisma: PrismaClient): GrantProvider {
  return createGrantProvider(prisma)
}
