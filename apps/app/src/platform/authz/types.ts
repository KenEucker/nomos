/**
 * Nomos Authorization Types
 *
 * Core type definitions for the authorization system as defined in
 * docs/nomos-authorization.spec.md
 */

// =============================================================================
// Subject
// =============================================================================

/**
 * A Subject is the actor requesting authority.
 * Nomos AuthZ never assumes what a subject *is* — only that it is identifiable.
 */
export interface Subject {
  type: "user" | "apiKey" | "service" | string
  id: string
  claims?: Record<string, unknown>
}

// =============================================================================
// Grants
// =============================================================================

/**
 * The resolved permissions and roles for a subject.
 */
export interface Grants {
  permissions: Set<string>
  roles: string[]
}

// =============================================================================
// Decision
// =============================================================================

export type DecisionOutcome = "allow" | "deny" | "abstain"

export type DecisionSurface = {
  kind: "api" | "astro" | "ui" | "job" | "cli"
  id?: string
}

export type DecisionTrace = {
  requestId?: string
  correlationId?: string
}

export interface DecisionInput {
  intent: string
  subject: Subject
  resource?: { type: string; id?: string }
  context?: Record<string, unknown>
  surface?: DecisionSurface
  trace?: DecisionTrace
  at: string
}

export type FailureKind =
  | "missing_permission"
  | "policy_failed"
  | "missing_context"
  | "provider_error"
  | "no_subject"

export interface DecisionEvidence {
  effectivePermissions?: string[]
  roles?: Array<{ roleKey: string; source: "db" | "claims" | "static" }>
  policyChecks?: Array<{
    policyKey: string
    result: "pass" | "fail" | "skip"
    reason?: string
    missingContextKeys?: string[]
    durationMs?: number
  }>
  failure?: {
    kind: FailureKind
    detail?: string
  }
  timings?: {
    grantsMs?: number
    policiesMs?: number
    totalMs?: number
  }
}

/**
 * The DECIDE rationale structure for explainable decisions.
 */
export interface DecideRationale {
  mantra: "DECIDE"

  define: {
    statement: string
    requestedIntent: string
    surface?: DecisionSurface
  }

  explore?: Array<{ option: string; notes?: string }>

  consider?: {
    constraints?: string[]
    considerations?: string[]
    assumptions?: string[]
  }

  identify?: {
    outcome: DecisionOutcome
    option: string
  }

  document?: {
    summary: string
    reasons: string[]
    refs?: Array<{ label: string; ref: string }>
  }

  evaluate?: {
    status: "pending" | "verified" | "needs_review"
    notes?: string
    measuredAt?: string
    signals?: Array<{ name: string; value: number | string | boolean; detail?: string }>
  }
}

/**
 * The complete decision object returned by the authorization engine.
 */
export interface Decision {
  version: 1
  input: DecisionInput
  outcome: DecisionOutcome
  allowed: boolean
  evidence: DecisionEvidence
  rationale?: DecideRationale
}

// =============================================================================
// Policy
// =============================================================================

export interface PolicyContext {
  subject: Subject
  intent: string
  context: Record<string, unknown>
  resource?: { type: string; id?: string }
}

export interface PolicyResult {
  ok: boolean
  reason?: string
}

/**
 * A Policy is optional code that refines an intent check using runtime context.
 * Policies run after intent checks, are pure functions, and handle ownership,
 * state, and boundary logic.
 */
export interface Policy {
  /** Unique identifier for this policy */
  key: string
  /** Which intents this policy applies to. Use "*" for all intents. */
  intents: string[]
  /** Required context keys. Missing keys cause deterministic denial. */
  requires?: string[]
  /** Evaluate the policy. Must be pure and deterministic. */
  evaluate(ctx: PolicyContext): Promise<PolicyResult> | PolicyResult
}

// =============================================================================
// Engine Options
// =============================================================================

export interface DecideOptions {
  /** Include DECIDE rationale in the decision */
  explain?: boolean
  /** Include effective permissions in evidence */
  includePermissions?: boolean
  /** Override surface information */
  surface?: DecisionSurface
  /** Override trace information */
  trace?: DecisionTrace
}
