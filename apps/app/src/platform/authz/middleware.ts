/**
 * Nomos Authorization Middleware
 *
 * Fastify middleware adapters for the authorization system.
 */

import type { FastifyRequest, FastifyReply } from "fastify"
import type { AuthorizationEngine } from "./engine"
import type { Subject, Decision } from "./types"

// =============================================================================
// Middleware Factory
// =============================================================================

export interface AuthzMiddleware {
  /**
   * Create a middleware that requires a specific intent.
   * Returns 401 if no subject, 403 if permission denied.
   */
  requireIntent(intent: string): (request: FastifyRequest, reply: FastifyReply) => Promise<void>

  /**
   * Check if the current subject has a permission (non-blocking).
   * Returns the decision without sending a response.
   */
  checkIntent(request: FastifyRequest, intent: string): Promise<Decision>
}

export function createAuthzMiddleware(engine: AuthorizationEngine): AuthzMiddleware {
  return {
    requireIntent(intent: string) {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        // Get subject from request context
        const subject = getSubjectFromRequest(request)

        if (!subject) {
          return reply.code(401).send({
            error: "unauthorized",
            message: "Authentication required",
          })
        }

        // Make authorization decision
        const decision = await engine.decide({
          intent,
          subject,
          context: {
            params: request.params,
            query: request.query,
          },
          surface: {
            kind: "api",
            id: request.routeOptions?.url ?? request.url,
          },
          trace: {
            requestId: request.id,
          },
        })

        if (!decision.allowed) {
          return reply.code(403).send({
            error: "forbidden",
            intent,
            reason: decision.evidence.failure?.kind ?? "access_denied",
            message: decision.evidence.failure?.detail ?? "You do not have permission to perform this action",
          })
        }

        // Attach decision to request context for audit logging
        attachDecisionToRequest(request, decision)
      }
    },

    async checkIntent(request: FastifyRequest, intent: string): Promise<Decision> {
      const subject = getSubjectFromRequest(request)

      if (!subject) {
        return {
          version: 1,
          input: {
            intent,
            subject: { type: "unknown", id: "unknown" },
            at: new Date().toISOString(),
          },
          outcome: "deny",
          allowed: false,
          evidence: {
            failure: { kind: "no_subject", detail: "No authenticated subject" },
          },
        }
      }

      return engine.decide({
        intent,
        subject,
        context: {
          params: request.params,
          query: request.query,
        },
        surface: {
          kind: "api",
          id: request.routeOptions?.url ?? request.url,
        },
        trace: {
          requestId: request.id,
        },
      })
    },
  }
}

// =============================================================================
// Request Helpers
// =============================================================================

/**
 * Extract Subject from the request context.
 * This relies on the authentication middleware having already resolved the subject.
 */
function getSubjectFromRequest(request: FastifyRequest): Subject | undefined {
  // The ctx object is attached by createApp.ts
  const ctx = (request as any).ctx

  if (!ctx) {
    return undefined
  }

  // Check for subject (new unified model)
  if (ctx.subject) {
    return ctx.subject
  }

  // Fallback: Convert legacy user to subject
  if (ctx.user) {
    return {
      type: "user",
      id: ctx.user.id,
      claims: {
        email: ctx.user.email,
        name: ctx.user.name,
        roles: ctx.user.roles,
      },
    }
  }

  // Fallback: Convert legacy apiClient to subject
  if (ctx.apiClient) {
    return {
      type: "apiKey",
      id: ctx.apiClient.id,
      claims: {
        name: ctx.apiClient.name,
        permissions: ctx.apiClient.permissions,
      },
    }
  }

  return undefined
}

/**
 * Attach the authorization decision to the request for audit logging.
 */
function attachDecisionToRequest(request: FastifyRequest, decision: Decision): void {
  const ctx = (request as any).ctx
  if (ctx) {
    ctx.authzDecision = decision
  }
}

// =============================================================================
// Route Config Helper
// =============================================================================

/**
 * Helper to check if a route requires authorization based on its config.
 */
export function routeRequiresAuth(config: { auth?: string; intent?: string }): boolean {
  return config.auth === "required" || Boolean(config.intent)
}

/**
 * Get the intent from route config.
 */
export function getRouteIntent(config: { intent?: string }): string | undefined {
  return config.intent
}
