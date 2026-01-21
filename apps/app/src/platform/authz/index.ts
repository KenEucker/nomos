/**
 * Nomos Authorization Module
 *
 * Provides intent-based authorization for the Nomos platform.
 *
 * @example
 * ```typescript
 * import { createAuthorizationEngine, createGrantProvider, createPolicyRegistry } from "./authz"
 *
 * // Create the authorization stack
 * const grantProvider = createGrantProvider(prisma)
 * const policyRegistry = createPolicyRegistry()
 * const engine = createAuthorizationEngine({ grantProvider, policyRegistry })
 *
 * // Use in routes
 * const authz = createAuthzMiddleware(engine)
 *
 * // Route config
 * export const config = {
 *   auth: "required",
 *   intent: "posts.read"
 * }
 * ```
 */

// Types
export type {
  Subject,
  Grants,
  Decision,
  DecisionInput,
  DecisionOutcome,
  DecisionEvidence,
  DecisionSurface,
  DecisionTrace,
  DecideRationale,
  DecideOptions,
  FailureKind,
  Policy,
  PolicyContext,
  PolicyResult,
} from "./types"

// Grant Provider
export {
  createGrantProvider,
  createRequestScopedGrantProvider,
  type GrantProvider,
} from "./grantProvider"

// Authorization Engine
export {
  createAuthorizationEngine,
  type AuthorizationEngine,
  type AuthorizationEngineOptions,
} from "./engine"

// Policy Registry
export {
  createPolicyRegistry,
  ownershipPolicy,
  createTimeBasedPolicy,
  type PolicyRegistry,
} from "./policies"

// Middleware
export {
  createAuthzMiddleware,
  routeRequiresAuth,
  getRouteIntent,
  type AuthzMiddleware,
} from "./middleware"

// Seeder
export {
  seedAuthzDatabase,
  ensurePermissions,
  ensureDefaultRoles,
  collectIntentsFromPlugin,
  collectIntentsFromPlugins,
  CORE_INTENTS,
  DEFAULT_ROLES,
  DEFAULT_ADMIN_ROLE,
  DEFAULT_VIEWER_ROLE,
  DEFAULT_MANAGER_ROLE,
  type CoreIntent,
  type SeederOptions,
} from "./seeder"
