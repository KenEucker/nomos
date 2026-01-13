/**
 * Template Resolver
 *
 * Resolves Svelte templates for rendering page modules. Resolution order:
 * 1. Plugin override: plugins/<plugin>/templates/<resource>/<View>.svelte
 * 2. Platform module override: platform/<module>/templates/<resource>/<View>.svelte
 * 3. Resource-specific default: admin-ui/templates/<resource>/<View>.svelte
 * 4. Generic fallback: admin-ui/templates/_default/<View>.svelte
 *
 * Templates are pure renderers - business logic lives in page modules.
 */

import type { Component } from "svelte";
import type { ViewType } from "../pages/types";

// ============================================================================
// Types
// ============================================================================

export interface ResolvedTemplate {
  /** The Svelte component */
  component: Component;
  /** Source path for debugging */
  source: string;
  /** Override type */
  type: "plugin" | "platform" | "resource" | "default";
}

export interface TemplateResolutionResult {
  template: ResolvedTemplate;
  /** Other candidates that were considered (for debugging) */
  candidates: Array<{ path: string; exists: boolean }>;
}

export class TemplateError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "LOAD_FAILED"
  ) {
    super(message);
    this.name = "TemplateError";
  }
}

// ============================================================================
// Template Discovery
// ============================================================================

// Discover all templates using import.meta.glob
// These patterns are statically analyzed by Vite at build time

// Admin-UI default templates (resource-specific and _default fallback)
const adminTemplates = import.meta.glob<{ default: Component }>(
  "/src/admin-ui/src/templates/**/*.svelte",
  { eager: false }
);

// Plugin template overrides
const pluginTemplates = import.meta.glob<{ default: Component }>(
  "/src/plugins/**/templates/**/*.svelte",
  { eager: false }
);

// Platform module template overrides
const platformTemplates = import.meta.glob<{ default: Component }>(
  "/src/platform/**/templates/**/*.svelte",
  { eager: false }
);

// ============================================================================
// Path Normalization
// ============================================================================

interface ParsedPath {
  key: string; // "resource/View" or "_default/View"
  source: string;
  type: "plugin" | "platform" | "resource" | "default";
}

function parseAdminTemplatePath(path: string): ParsedPath | null {
  // Expected: /src/admin-ui/src/templates/<resource>/<View>.svelte
  // or: /src/admin-ui/src/templates/_default/<View>.svelte
  const match = path.match(/\/templates\/([^/]+)\/([^/]+)\.svelte$/);
  if (!match) return null;

  const [, resource, view] = match;
  const isDefault = resource === "_default";

  return {
    key: `${resource}/${view}`,
    source: path,
    type: isDefault ? "default" : "resource",
  };
}

function parsePluginTemplatePath(path: string): ParsedPath | null {
  // Expected: /src/plugins/<plugin>/templates/<resource>/<View>.svelte
  const match = path.match(/\/plugins\/[^/]+\/templates\/([^/]+)\/([^/]+)\.svelte$/);
  if (!match) return null;

  return {
    key: `${match[1]}/${match[2]}`,
    source: path,
    type: "plugin",
  };
}

function parsePlatformTemplatePath(path: string): ParsedPath | null {
  // Expected: /src/platform/<module>/templates/<resource>/<View>.svelte
  const match = path.match(/\/platform\/[^/]+\/templates\/([^/]+)\/([^/]+)\.svelte$/);
  if (!match) return null;

  return {
    key: `${match[1]}/${match[2]}`,
    source: path,
    type: "platform",
  };
}

// ============================================================================
// Build Template Registry
// ============================================================================

interface TemplateEntry {
  loader: () => Promise<{ default: Component }>;
  source: string;
  type: "plugin" | "platform" | "resource" | "default";
}

// Build lookup maps by normalized key
const templateRegistry = new Map<string, TemplateEntry[]>();

function addToRegistry(
  parsed: ParsedPath | null,
  loader: () => Promise<{ default: Component }>
): void {
  if (!parsed) return;

  const entries = templateRegistry.get(parsed.key) ?? [];
  entries.push({
    loader,
    source: parsed.source,
    type: parsed.type,
  });
  templateRegistry.set(parsed.key, entries);
}

// Register plugin templates (highest priority)
for (const [path, loader] of Object.entries(pluginTemplates)) {
  addToRegistry(parsePluginTemplatePath(path), loader as () => Promise<{ default: Component }>);
}

// Register platform templates
for (const [path, loader] of Object.entries(platformTemplates)) {
  addToRegistry(parsePlatformTemplatePath(path), loader as () => Promise<{ default: Component }>);
}

// Register admin-ui templates (resource-specific and default)
for (const [path, loader] of Object.entries(adminTemplates)) {
  addToRegistry(parseAdminTemplatePath(path), loader as () => Promise<{ default: Component }>);
}

// ============================================================================
// Resolution Logic
// ============================================================================

// Priority order for template types
const typePriority: Record<TemplateEntry["type"], number> = {
  plugin: 0,    // Highest priority
  platform: 1,
  resource: 2,
  default: 3,   // Lowest priority
};

function sortByPriority(entries: TemplateEntry[]): TemplateEntry[] {
  return [...entries].sort((a, b) => {
    // Sort by type priority first
    const priorityDiff = typePriority[a.type] - typePriority[b.type];
    if (priorityDiff !== 0) return priorityDiff;

    // For same priority (e.g., multiple plugins), sort alphabetically by path
    // This ensures deterministic behavior
    return a.source.localeCompare(b.source);
  });
}

function logCollisionWarning(entries: TemplateEntry[], key: string): void {
  const sameType = entries.filter((e) => e.type === entries[0].type);
  if (sameType.length > 1) {
    console.warn(
      `[Template Resolver] Multiple ${entries[0].type} templates found for "${key}". ` +
      `Using "${sameType[0].source}" (alphabetically first). ` +
      `Other candidates: ${sameType.slice(1).map((e) => e.source).join(", ")}`
    );
  }
}

// ============================================================================
// Main Resolver
// ============================================================================

/**
 * Resolve a template for the given resource and view
 *
 * @param resourceId - The resource identifier (e.g., "users")
 * @param view - The view type (List, Form, or Show)
 * @returns The resolved template with metadata
 * @throws TemplateError if no template found
 */
export async function resolveTemplate(
  resourceId: string,
  view: ViewType
): Promise<TemplateResolutionResult> {
  const resourceKey = `${resourceId}/${view}`;
  const defaultKey = `_default/${view}`;

  const candidates: Array<{ path: string; exists: boolean }> = [];

  // Get entries for resource-specific key
  const resourceEntries = templateRegistry.get(resourceKey) ?? [];
  for (const entry of resourceEntries) {
    candidates.push({ path: entry.source, exists: true });
  }

  // Get entries for default fallback
  const defaultEntries = templateRegistry.get(defaultKey) ?? [];
  for (const entry of defaultEntries) {
    candidates.push({ path: entry.source, exists: true });
  }

  // Combine and sort all entries
  const allEntries = [...resourceEntries, ...defaultEntries];

  if (allEntries.length === 0) {
    throw new TemplateError(
      `No template found for "${resourceKey}". ` +
      `Checked: templates/${resourceId}/${view}.svelte, templates/_default/${view}.svelte`,
      "NOT_FOUND"
    );
  }

  const sorted = sortByPriority(allEntries);

  // Log warning if there are collisions at the same priority level
  logCollisionWarning(sorted, resourceKey);

  // Load the winning template
  const winner = sorted[0];

  try {
    const mod = await winner.loader();
    return {
      template: {
        component: mod.default,
        source: winner.source,
        type: winner.type,
      },
      candidates,
    };
  } catch (error) {
    throw new TemplateError(
      `Failed to load template from "${winner.source}": ${error}`,
      "LOAD_FAILED"
    );
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a template exists for a resource/view
 */
export function hasTemplate(resourceId: string, view: ViewType): boolean {
  const resourceKey = `${resourceId}/${view}`;
  const defaultKey = `_default/${view}`;

  return (
    templateRegistry.has(resourceKey) ||
    templateRegistry.has(defaultKey)
  );
}

/**
 * Get all registered template keys
 */
export function getTemplateKeys(): string[] {
  return Array.from(templateRegistry.keys());
}

/**
 * Get template sources for a specific key (for debugging)
 */
export function getTemplateSources(resourceId: string, view: ViewType): string[] {
  const resourceKey = `${resourceId}/${view}`;
  const entries = templateRegistry.get(resourceKey) ?? [];
  return entries.map((e) => e.source);
}
