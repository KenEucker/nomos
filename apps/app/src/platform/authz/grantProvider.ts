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
 * - For subject.type === "user": UserRole → Role → RolePermission → Permission (single source of truth; no SubjectRole).
 * - For other types (e.g. apiKey): direct permissions from subject.claims?.permissions only.
 *
 * Returns empty grants on error (deny-by-default).
 */
async function resolveGrants(prisma: PrismaClient, subject: Subject): Promise<Grants> {
  const permissions = new Set<string>()
  let roles: string[] = []

  try {
    if (subject.type === "user") {
      // Resolve user grants from UserRole (no SubjectRole)
      const userRoles = await prisma.userRole.findMany({
        where: { userId: subject.id },
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      })
      roles = userRoles.map((ur) => ur.role.key)
      for (const ur of userRoles) {
        for (const rp of ur.role.permissions) {
          permissions.add(rp.permission.key)
        }
      }
    }

    // Merge direct permissions from claims (e.g. API keys, or extra grants)
    if (subject.claims?.permissions) {
      const claimsPermissions = subject.claims.permissions as string[]
      for (const perm of claimsPermissions) {
        permissions.add(perm)
      }
    }

    return { permissions, roles }
  } catch (error) {
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
