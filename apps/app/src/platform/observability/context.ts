/**
 * Nomos Observability Execution Context
 *
 * Establishes execution context at request entry and propagates it
 * automatically through the request lifecycle using AsyncLocalStorage.
 *
 * All emitted events inherit this context implicitly.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { nanoid } from 'nanoid'
import type { NomosContext, NomosEnv, NomosId } from './types'

// =============================================================================
// Context Store
// =============================================================================

/**
 * AsyncLocalStorage instance for propagating execution context.
 * This ensures context is available throughout the entire request chain
 * without explicit parameter passing.
 */
const contextStorage = new AsyncLocalStorage<NomosContext>()

// =============================================================================
// Default Context
// =============================================================================

let defaultEnv: NomosEnv = 'dev'
let defaultBuildId: string | undefined
let defaultVersion: string | undefined

/**
 * Stable anonymous context singleton for code running outside of request context.
 * This ensures that steps recorded outside of a request context are still retrievable
 * via collectSteps() - without this, each call to getContextOrAnonymous() would return
 * a different object, making WeakMap-based step collection impossible.
 */
let anonymousContext: NomosContext | null = null

function getAnonymousContext(): NomosContext {
  if (!anonymousContext) {
    anonymousContext = {
      env: defaultEnv,
      buildId: defaultBuildId,
      version: defaultVersion,
    }
  }
  return anonymousContext
}

/**
 * Configure the default context values for new requests.
 * Should be called once at application startup.
 */
export function configureDefaultContext(config: {
  env?: NomosEnv
  buildId?: string
  version?: string
}): void {
  if (config.env) defaultEnv = config.env
  if (config.buildId) defaultBuildId = config.buildId
  if (config.version) defaultVersion = config.version
  // Reset anonymous context so it picks up new defaults
  anonymousContext = null
}

// =============================================================================
// Context Factory
// =============================================================================

export interface CreateContextOptions {
  requestId?: NomosId
  traceId?: NomosId
  spanId?: NomosId
  actorId?: NomosId
  actorType?: string
  tenantId?: NomosId
  tags?: Record<string, string>
}

/**
 * Create a new execution context with the given options.
 * Missing IDs will be auto-generated.
 */
export function createContext(options: CreateContextOptions = {}): NomosContext {
  return {
    requestId: options.requestId ?? nanoid(),
    traceId: options.traceId ?? nanoid(),
    spanId: options.spanId ?? nanoid(),
    actorId: options.actorId,
    actorType: options.actorType,
    tenantId: options.tenantId,
    env: defaultEnv,
    buildId: defaultBuildId,
    version: defaultVersion,
    tags: options.tags,
  }
}

/**
 * Create a child span context from a parent context.
 * Preserves request and trace IDs, generates new span ID.
 */
export function createChildContext(parent: NomosContext): NomosContext {
  return {
    ...parent,
    spanId: nanoid(),
  }
}

// =============================================================================
// Context Access
// =============================================================================

/**
 * Get the current execution context.
 * Returns undefined if called outside of a context scope.
 */
export function getContext(): NomosContext | undefined {
  return contextStorage.getStore()
}

/**
 * Get the current execution context or throw if not available.
 * Use this when context is required.
 */
export function requireContext(): NomosContext {
  const ctx = contextStorage.getStore()
  if (!ctx) {
    throw new Error('No execution context available. Ensure code runs within runWithContext().')
  }
  return ctx
}

/**
 * Get the current execution context or a fallback "anonymous" context.
 * Useful for code that may run both inside and outside of request context.
 * 
 * Note: When no AsyncLocalStorage context exists, returns a stable singleton
 * to ensure that step collection (which uses WeakMap) works correctly.
 */
export function getContextOrAnonymous(): NomosContext {
  return contextStorage.getStore() ?? getAnonymousContext()
}

// =============================================================================
// Context Execution
// =============================================================================

/**
 * Run a function within an execution context.
 * The context will be automatically available to all code within the scope.
 */
export function runWithContext<T>(ctx: NomosContext, fn: () => T): T {
  return contextStorage.run(ctx, fn)
}

/**
 * Run an async function within an execution context.
 * The context will be automatically available throughout the async chain.
 */
export async function runWithContextAsync<T>(
  ctx: NomosContext,
  fn: () => Promise<T>
): Promise<T> {
  return contextStorage.run(ctx, fn)
}

/**
 * Run a function within a child span of the current context.
 * Creates a new span ID while preserving request and trace IDs.
 */
export function runWithChildSpan<T>(fn: () => T): T {
  const parent = getContext()
  if (!parent) {
    // No parent context - create a new one
    return runWithContext(createContext(), fn)
  }
  return runWithContext(createChildContext(parent), fn)
}

/**
 * Run an async function within a child span of the current context.
 */
export async function runWithChildSpanAsync<T>(fn: () => Promise<T>): Promise<T> {
  const parent = getContext()
  if (!parent) {
    return runWithContextAsync(createContext(), fn)
  }
  return runWithContextAsync(createChildContext(parent), fn)
}

// =============================================================================
// Context Mutation (Scoped)
// =============================================================================

/**
 * Run a function with updated context values.
 * Does not mutate the original context - creates a new context for the scope.
 */
export function runWithUpdatedContext<T>(
  updates: Partial<NomosContext>,
  fn: () => T
): T {
  const current = getContextOrAnonymous()
  const updated: NomosContext = {
    ...current,
    ...updates,
    tags: updates.tags ? { ...current.tags, ...updates.tags } : current.tags,
  }
  return runWithContext(updated, fn)
}

/**
 * Async variant of runWithUpdatedContext.
 */
export async function runWithUpdatedContextAsync<T>(
  updates: Partial<NomosContext>,
  fn: () => Promise<T>
): Promise<T> {
  const current = getContextOrAnonymous()
  const updated: NomosContext = {
    ...current,
    ...updates,
    tags: updates.tags ? { ...current.tags, ...updates.tags } : current.tags,
  }
  return runWithContextAsync(updated, fn)
}

// =============================================================================
// Context Utilities
// =============================================================================

/**
 * Extract the request ID from the current context.
 */
export function getRequestId(): NomosId | undefined {
  return getContext()?.requestId
}

/**
 * Extract the trace ID from the current context.
 */
export function getTraceId(): NomosId | undefined {
  return getContext()?.traceId
}

/**
 * Extract the span ID from the current context.
 */
export function getSpanId(): NomosId | undefined {
  return getContext()?.spanId
}

/**
 * Check if there is an active execution context.
 */
export function hasContext(): boolean {
  return contextStorage.getStore() !== undefined
}
