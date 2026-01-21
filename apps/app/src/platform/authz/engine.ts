/**
 * Nomos Authorization Engine
 *
 * The core decision engine that evaluates authority requests.
 * Implements the decision algorithm defined in docs/nomos-authorization.spec.md
 */

import type {
  Subject,
  Decision,
  DecisionInput,
  DecisionEvidence,
  DecideOptions,
  DecideRationale,
  FailureKind,
} from "./types"
import type { GrantProvider } from "./grantProvider"
import type { PolicyRegistry } from "./policies"

// =============================================================================
// Authorization Engine Interface
// =============================================================================

export interface AuthorizationEngine {
  /**
   * Make an authorization decision with full evidence.
   */
  decide(
    input: Omit<DecisionInput, "at">,
    options?: DecideOptions
  ): Promise<Decision>

  /**
   * Simple boolean authorization check.
   * Returns true if allowed, false otherwise.
   */
  authorize(
    subject: Subject,
    intent: string,
    ctx?: Record<string, unknown>
  ): Promise<boolean>
}

// =============================================================================
// Engine Factory
// =============================================================================

export interface AuthorizationEngineOptions {
  grantProvider: GrantProvider
  policyRegistry?: PolicyRegistry
}

export function createAuthorizationEngine(
  options: AuthorizationEngineOptions
): AuthorizationEngine {
  const { grantProvider, policyRegistry } = options

  return {
    async decide(input, opts = {}): Promise<Decision> {
      const startTime = performance.now()
      const at = new Date().toISOString()
      const fullInput: DecisionInput = { ...input, at }

      // Step 1: Validate subject exists
      if (!input.subject) {
        return createDenial(fullInput, "no_subject", "No subject provided", {
          totalMs: performance.now() - startTime,
        })
      }

      // Step 2: Resolve effective grants
      const grantsStart = performance.now()
      let permissions: Set<string>
      let roles: string[]

      try {
        const grants = await grantProvider.getGrants(input.subject)
        permissions = grants.permissions
        roles = grants.roles
      } catch (error) {
        return createDenial(
          fullInput,
          "provider_error",
          `Grant resolution failed: ${String(error)}`,
          { totalMs: performance.now() - startTime }
        )
      }
      const grantsMs = performance.now() - grantsStart

      // Step 3: Check if intent exists in grants
      const hasWildcard = permissions.has("*")
      const hasIntent = permissions.has(input.intent)

      if (!hasIntent && !hasWildcard) {
        return createDenial(
          fullInput,
          "missing_permission",
          `Subject lacks intent: ${input.intent}`,
          {
            grantsMs,
            totalMs: performance.now() - startTime,
            roles,
            permissions: opts.includePermissions ? Array.from(permissions) : undefined,
          }
        )
      }

      // Step 4: Evaluate policies (if registry exists and has policies for this intent)
      const policiesStart = performance.now()
      const policyChecks: DecisionEvidence["policyChecks"] = []

      if (policyRegistry) {
        const policies = policyRegistry.getPoliciesForIntent(input.intent)

        for (const policy of policies) {
          const policyStart = performance.now()

          // Check required context keys
          if (policy.requires?.length) {
            const missingKeys = policy.requires.filter(
              (key) => !(key in (input.context ?? {}))
            )
            if (missingKeys.length > 0) {
              policyChecks.push({
                policyKey: policy.key,
                result: "fail",
                reason: `Missing required context keys: ${missingKeys.join(", ")}`,
                missingContextKeys: missingKeys,
                durationMs: performance.now() - policyStart,
              })

              return createDenial(
                fullInput,
                "missing_context",
                `Policy "${policy.key}" requires context: ${missingKeys.join(", ")}`,
                {
                  grantsMs,
                  policiesMs: performance.now() - policiesStart,
                  totalMs: performance.now() - startTime,
                  roles,
                  permissions: opts.includePermissions ? Array.from(permissions) : undefined,
                  policyChecks,
                }
              )
            }
          }

          // Evaluate policy
          try {
            const result = await policy.evaluate({
              subject: input.subject,
              intent: input.intent,
              context: input.context ?? {},
              resource: input.resource,
            })

            policyChecks.push({
              policyKey: policy.key,
              result: result.ok ? "pass" : "fail",
              reason: result.reason,
              durationMs: performance.now() - policyStart,
            })

            if (!result.ok) {
              return createDenial(
                fullInput,
                "policy_failed",
                result.reason ?? `Policy "${policy.key}" denied access`,
                {
                  grantsMs,
                  policiesMs: performance.now() - policiesStart,
                  totalMs: performance.now() - startTime,
                  roles,
                  permissions: opts.includePermissions ? Array.from(permissions) : undefined,
                  policyChecks,
                }
              )
            }
          } catch (error) {
            policyChecks.push({
              policyKey: policy.key,
              result: "fail",
              reason: `Policy evaluation error: ${String(error)}`,
              durationMs: performance.now() - policyStart,
            })

            return createDenial(
              fullInput,
              "policy_failed",
              `Policy "${policy.key}" threw an error`,
              {
                grantsMs,
                policiesMs: performance.now() - policiesStart,
                totalMs: performance.now() - startTime,
                roles,
                permissions: opts.includePermissions ? Array.from(permissions) : undefined,
                policyChecks,
              }
            )
          }
        }
      }
      const policiesMs = performance.now() - policiesStart

      // Step 5: Allow
      const decision: Decision = {
        version: 1,
        input: fullInput,
        outcome: "allow",
        allowed: true,
        evidence: {
          effectivePermissions: opts.includePermissions ? Array.from(permissions) : undefined,
          roles: roles.map((r) => ({ roleKey: r, source: "db" as const })),
          policyChecks: policyChecks.length > 0 ? policyChecks : undefined,
          timings: {
            grantsMs,
            policiesMs: policyChecks.length > 0 ? policiesMs : undefined,
            totalMs: performance.now() - startTime,
          },
        },
      }

      // Step 6: Attach DECIDE rationale if requested
      if (opts.explain) {
        decision.rationale = createRationale(fullInput, decision)
      }

      return decision
    },

    async authorize(subject, intent, ctx): Promise<boolean> {
      const decision = await this.decide({
        subject,
        intent,
        context: ctx,
      })
      return decision.allowed
    },
  }
}

// =============================================================================
// Helpers
// =============================================================================

interface DenialTimings {
  grantsMs?: number
  policiesMs?: number
  totalMs: number
  roles?: string[]
  permissions?: string[]
  policyChecks?: DecisionEvidence["policyChecks"]
}

function createDenial(
  input: DecisionInput,
  kind: FailureKind,
  detail: string,
  timings: DenialTimings
): Decision {
  return {
    version: 1,
    input,
    outcome: "deny",
    allowed: false,
    evidence: {
      effectivePermissions: timings.permissions,
      roles: timings.roles?.map((r) => ({ roleKey: r, source: "db" as const })),
      policyChecks: timings.policyChecks,
      failure: { kind, detail },
      timings: {
        grantsMs: timings.grantsMs,
        policiesMs: timings.policiesMs,
        totalMs: timings.totalMs,
      },
    },
  }
}

function createRationale(input: DecisionInput, decision: Decision): DecideRationale {
  return {
    mantra: "DECIDE",
    define: {
      statement: `Authorization request for intent "${input.intent}"`,
      requestedIntent: input.intent,
      surface: input.surface,
    },
    identify: {
      outcome: decision.outcome,
      option: decision.allowed ? "Grant access" : "Deny access",
    },
    document: {
      summary: decision.allowed
        ? `Access granted for intent "${input.intent}"`
        : `Access denied for intent "${input.intent}"`,
      reasons: decision.allowed
        ? ["Subject has required permission", ...(decision.evidence.policyChecks?.filter(p => p.result === "pass").map(p => `Policy "${p.policyKey}" passed`) ?? [])]
        : [decision.evidence.failure?.detail ?? "Unknown reason"],
    },
    evaluate: {
      status: "pending",
    },
  }
}
