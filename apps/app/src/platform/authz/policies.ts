/**
 * Nomos Policy Registry
 *
 * Manages registration and lookup of authorization policies.
 * Policies are optional contextual refinements that run after intent checks.
 */

import type { Policy } from "./types"

// =============================================================================
// Policy Registry Interface
// =============================================================================

export interface PolicyRegistry {
  /**
   * Register a policy with the registry.
   */
  register(policy: Policy): void

  /**
   * Register multiple policies at once.
   */
  registerAll(policies: Policy[]): void

  /**
   * Get all policies that apply to a given intent.
   * Returns policies that match the intent exactly or use wildcard "*".
   */
  getPoliciesForIntent(intent: string): Policy[]

  /**
   * Get all registered policies.
   */
  getAllPolicies(): Policy[]

  /**
   * Check if a policy with the given key exists.
   */
  hasPolicy(key: string): boolean
}

// =============================================================================
// Implementation
// =============================================================================

export function createPolicyRegistry(): PolicyRegistry {
  const policies = new Map<string, Policy>()

  return {
    register(policy: Policy): void {
      if (policies.has(policy.key)) {
        console.warn(`[authz] Policy "${policy.key}" already registered, overwriting`)
      }
      policies.set(policy.key, policy)
    },

    registerAll(policyList: Policy[]): void {
      for (const policy of policyList) {
        this.register(policy)
      }
    },

    getPoliciesForIntent(intent: string): Policy[] {
      const matching: Policy[] = []

      for (const policy of policies.values()) {
        // Check if policy applies to this intent
        if (policy.intents.includes(intent) || policy.intents.includes("*")) {
          matching.push(policy)
        }
      }

      return matching
    },

    getAllPolicies(): Policy[] {
      return Array.from(policies.values())
    },

    hasPolicy(key: string): boolean {
      return policies.has(key)
    },
  }
}

// =============================================================================
// Built-in Policies
// =============================================================================

/**
 * Example: Ownership policy
 * Requires "resourceOwnerId" in context and checks if subject owns the resource.
 */
export const ownershipPolicy: Policy = {
  key: "ownership",
  intents: ["*.update", "*.delete"], // Apply to all update/delete intents
  requires: ["resourceOwnerId"],
  evaluate({ subject, context }) {
    const ownerId = context.resourceOwnerId as string

    // Allow if subject owns the resource
    if (ownerId === subject.id) {
      return { ok: true }
    }

    // Check if subject has admin override
    if (subject.claims?.isAdmin === true) {
      return { ok: true, reason: "Admin override" }
    }

    return { ok: false, reason: "Subject does not own this resource" }
  },
}

/**
 * Example: Time-based policy
 * Restricts access to certain hours.
 */
export function createTimeBasedPolicy(options: {
  key: string
  intents: string[]
  allowedHoursUtc: { start: number; end: number }
}): Policy {
  return {
    key: options.key,
    intents: options.intents,
    evaluate() {
      const hour = new Date().getUTCHours()
      const { start, end } = options.allowedHoursUtc

      if (hour >= start && hour < end) {
        return { ok: true }
      }

      return {
        ok: false,
        reason: `Access only allowed between ${start}:00 and ${end}:00 UTC`,
      }
    },
  }
}
