/**
 * Nomos Grant Provider
 *
 * Resolves effective permissions for a subject via database-backed RBAC.
 * Implements per-request memoization and deny-by-default on errors.
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
// Grant Resolution
// =============================================================================

/**
 * Resolve grants for a subject from the database.
 *
 * Query path:
 *   SubjectRole → Role → RolePermission → Permission
 *
 * Returns empty grants on error (deny-by-default).
 */
async function resolveGrants(prisma: PrismaClient, subject: Subject): Promise<Grants> {
  try {
    // Query all roles assigned to this subject, including their permissions
    const subjectRoles = await prisma.subjectRole.findMany({
      where: {
        subjectType: subject.type,
        subjectId: subject.id,
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    })

    // Collect roles
    const roles = subjectRoles.map((sr) => sr.role.key)

    // Collect permissions from all roles
    const permissions = new Set<string>()
    for (const sr of subjectRoles) {
      for (const rp of sr.role.permissions) {
        permissions.add(rp.permission.key)
      }
    }

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
