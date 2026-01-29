import type { Handler } from "../ctx";
import type { NomosObserver } from "../observability";
import type { PluginDatabaseDefinition } from "../db/pluginSchema";

export type PluginRoute = {
  baseDir: string;
  owner: string;
};

export type PluginResource = {
  name: string;
  label: string;
  fields: Array<{ name: string; type: string; required?: boolean; options?: string[] }>;
  actions?: string[];
  route: string;
};

/**
 * Plugin setup context providing access to platform services.
 *
 * Plugins can obtain an observer instance for structured observability:
 * ```ts
 * setup: async (hooks, events, { observer, createPluginObserver }) => {
 *   // Use the global observer
 *   observer?.event('plugin.initialized', {
 *     kind: 'log',
 *     level: 'info',
 *     data: { pluginSlug: 'my-plugin' }
 *   }).emit();
 *
 *   // Or create a dedicated observer for this plugin
 *   const myObserver = createPluginObserver?.('my-plugin');
 * }
 * ```
 */
export interface PluginSetupContext {
  /** Global observer instance (null if observability is disabled) */
  observer: NomosObserver | null;
  /** Factory to create a plugin-scoped observer */
  createPluginObserver: ((pluginSlug: string) => NomosObserver) | null;
}

export type PluginManifest = {
  slug?: string;
  name?: string;
  dependsOn?: string[];
  /**
   * Intents (permissions) declared by this plugin.
   * Format: "resource.action" (e.g., "posts.read", "posts.update")
   */
  intents?: string[];
  /**
   * @deprecated Use intents instead
   */
  permissions?: string[];
  roles?: string[];
  middleware?: Record<string, (...args: any[]) => any>;
  services?: Record<string, any>;
  /**
   * Plugin setup function called during initialization.
   *
   * @param hooks - Hook registry for plugin lifecycle hooks
   * @param events - Event bus for subscribing to platform events
   * @param context - Optional context with observer access (available in newer versions)
   *
   * Note: Plugins MUST use the observability API instead of direct console logging
   * for runtime behavior. Use `context.observer` or `context.createPluginObserver`.
   */
  setup?: (hooks: any, events: any, context?: PluginSetupContext) => void | Promise<void>;
  adminResources?: PluginResource[];
  adminPages?: Array<{ path: string; label: string }>;
  nav?: Array<{ path: string; label: string }>;
  events?: string[];
  listeners?: Array<{
    event: string;
    handler: Handler;
    mode?: "bestEffort" | "failFast";
  }>;
  inboundWebhooks?: Record<string, Handler>;
  /**
   * Database tables and columns this plugin requires.
   *
   * Tables are automatically prefixed with `plugin_{slug}_` to prevent
   * collisions. The platform validates, diffs, and applies schema changes
   * at runtime during the enable step — no Prisma codegen or server
   * restart is needed.
   *
   * @example
   * database: {
   *   tables: {
   *     posts: {
   *       columns: {
   *         id:        { type: "text", primaryKey: true, default: "cuid" },
   *         title:     { type: "text" },
   *         body:      { type: "text", nullable: true },
   *         authorId:  { type: "text", references: { table: "User", column: "id" } },
   *         createdAt: { type: "datetime", default: "now" },
   *       },
   *       indexes: [
   *         { columns: ["authorId"] },
   *       ],
   *     },
   *   },
   * }
   */
  database?: PluginDatabaseDefinition;
};
