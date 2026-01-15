/**
 * Page Module Resolver
 *
 * Resolves page modules for a given resource and view. Resolution order:
 * 1. Try to load handwritten module at: pages/<resource>/<View>.ts
 * 2. Fall back to compiling from resource definition
 *
 * This allows developers to override default behavior for complex workflows
 * while getting automatic CRUD for simple cases.
 */

import type {
  ViewType,
  PageModule,
  ListPageModule,
  FormPageModule,
  ShowPageModule,
  FormMode,
} from "./types";
import type { AdminResource } from "../resources/types";
import { compileListModule, compileFormModule, compileShowModule } from "./compileFromResource";

// ============================================================================
// Types
// ============================================================================

export interface ResolveOptions {
  /** Skip handwritten module lookup (always use compiled) */
  skipHandwritten?: boolean;
}

export class PageModuleError extends Error {
  constructor(
    message: string,
    public readonly code: "RESOURCE_NOT_FOUND" | "VIEW_INVALID" | "MODULE_LOAD_FAILED"
  ) {
    super(message);
    this.name = "PageModuleError";
  }
}

// ============================================================================
// Handwritten Module Loader
// ============================================================================

// Use import.meta.glob to discover handwritten page modules
// This allows Vite/Astro to statically analyze imports at build time
// This file is at: lib/pages/resolvePageModule.ts
// Handwritten modules are at: pages/*/*.ts (relative: ../../pages/)
// Note: This looks for TypeScript page modules, not Astro pages
const handwrittenModules = import.meta.glob<{ default: PageModule }>(
  "../../pages/**/*.page.ts",
  { eager: false }
);

// Discover Astro page definitions that export `staticPageDefinition`
// Astro route files live at: pages/<resource>/index.astro
const astroPageModules = import.meta.glob<{ staticPageDefinition?: PageModule }>(
  "../../pages/**/index.astro",
  { eager: false }
);

// Normalize paths to resourceId/View format
function normalizeModulePath(path: string): string | null {
  // Expected formats:
  // - ../../pages/<resource>/index.page.ts
  // - ../../pages/<resource>/new.page.ts
  // - ../../pages/<resource>/[id].page.ts
  // - ../../pages/<resource>/[id]/index.page.ts
  // - ../../pages/<resource>/[id]/edit.page.ts
  const match = path.match(/pages\/([^/]+)\/(.+)\.page\.ts$/);
  if (!match) return null;

  const [, resourceId, rawPath] = match;
  if (rawPath === "index") {
    return `${resourceId}/List`;
  }
  if (rawPath === "new") {
    return `${resourceId}/Form:create`;
  }
  if (rawPath === "[id]" || rawPath === "[id]/index") {
    return `${resourceId}/Show`;
  }
  if (rawPath === "[id]/edit") {
    return `${resourceId}/Form:edit`;
  }

  return null;
}

// Build lookup map
const handwrittenModuleMap = new Map<string, () => Promise<{ default: PageModule }>>();

for (const [path, loader] of Object.entries(handwrittenModules)) {
  const key = normalizeModulePath(path);
  if (key) {
    handwrittenModuleMap.set(key, loader as () => Promise<{ default: PageModule }>);
  }
}

// Build lookup map for Astro index.astro exports (List view only)
const astroModuleMap = new Map<string, () => Promise<{ staticPageDefinition?: PageModule }>>();
let rootAstroLoader: (() => Promise<{ staticPageDefinition?: PageModule }>) | null = null;

for (const [path, loader] of Object.entries(astroPageModules)) {
  const match = path.match(/pages\/([^/]+)\/index\.astro$/);
  if (match) {
    astroModuleMap.set(match[1], loader as () => Promise<{ staticPageDefinition?: PageModule }>);
    continue;
  }
  if (path.endsWith("/pages/index.astro")) {
    rootAstroLoader = loader as () => Promise<{ staticPageDefinition?: PageModule }>;
  }
}

/**
 * Try to load a handwritten module
 */
function getHandwrittenModuleLookupKeys(
  resourceId: string,
  view: ViewType,
  params?: { mode?: FormMode }
): string[] {
  if (view === "Form") {
    const modeKey = params?.mode === "edit" ? "Form:edit" : "Form:create";
    return [`${resourceId}/${modeKey}`, `${resourceId}/Form`];
  }
  return [`${resourceId}/${view}`];
}

async function loadHandwrittenModule(
  resourceId: string,
  view: ViewType,
  params?: { mode?: FormMode }
): Promise<PageModule | null> {
  const keys = getHandwrittenModuleLookupKeys(resourceId, view, params);
  const loaderEntry = keys
    .map((key) => ({ key, loader: handwrittenModuleMap.get(key) }))
    .find((entry) => entry.loader);

  if (!loaderEntry?.loader) {
    if (view === "List") {
      const astroLoader = astroModuleMap.get(resourceId);
      if (astroLoader) {
        try {
          const mod = await astroLoader();
          return mod.staticPageDefinition ?? null;
        } catch (error) {
          console.warn(`Failed to load Astro page module for ${resourceId}:`, error);
          return null;
        }
      }
      if (rootAstroLoader) {
        try {
          const mod = await rootAstroLoader();
          if (mod.staticPageDefinition?.resourceId === resourceId) {
            return mod.staticPageDefinition;
          }
        } catch (error) {
          console.warn(`Failed to load root Astro page module:`, error);
          return null;
        }
      }
      return null;
    }
    return null;
  }

  try {
    const mod = await loaderEntry.loader();
    return mod.default;
  } catch (error) {
    console.warn(`Failed to load handwritten module for ${loaderEntry.key}:`, error);
    return null;
  }
}

// ============================================================================
// Module Compiler
// ============================================================================

/**
 * Compile a page module from resource definition
 */
function compileModule(resource: AdminResource, view: ViewType): PageModule {
  switch (view) {
    case "List":
      return compileListModule(resource);
    case "Form":
      return compileFormModule(resource);
    case "Show":
      return compileShowModule(resource);
    default:
      throw new PageModuleError(
        `Invalid view "${view}". Must be one of: List, Form, Show`,
        "VIEW_INVALID"
      );
  }
}

// ============================================================================
// Main Resolver
// ============================================================================

/**
 * Resolve a page module for the given resource and view
 *
 * @param resourceId - The resource identifier (e.g., "users")
 * @param view - The view type (List, Form, or Show)
 * @param options - Resolution options
 * @returns The resolved page module
 * @throws PageModuleError if resource not found or view invalid
 */
export async function resolvePageModule(
  resource: AdminResource,
  view: ViewType,
  options: ResolveOptions = {},
  params?: { mode?: FormMode }
): Promise<PageModule> {
  // Validate view type
  if (!["List", "Form", "Show"].includes(view)) {
    throw new PageModuleError(
      `Invalid view "${view}". Must be one of: List, Form, Show`,
      "VIEW_INVALID"
    );
  }

  const resourceId = resource.id;

  // Try handwritten module first (unless skipped)
  if (!options.skipHandwritten) {
    const handwritten = await loadHandwrittenModule(resourceId, view, params);
    if (handwritten) {
      return handwritten;
    }
  }

  // Fall back to compiled module
  return compileModule(resource, view);
}

/**
 * Resolve a List page module
 */
export async function resolveListModule(
  resource: AdminResource,
  options?: ResolveOptions
): Promise<ListPageModule> {
  return resolvePageModule(resource, "List", options) as Promise<ListPageModule>;
}

/**
 * Resolve a Form page module
 */
export async function resolveFormModule(
  resource: AdminResource,
  options?: ResolveOptions
): Promise<FormPageModule> {
  return resolvePageModule(resource, "Form", options) as Promise<FormPageModule>;
}

/**
 * Resolve a Show page module
 */
export async function resolveShowModule(
  resource: AdminResource,
  options?: ResolveOptions
): Promise<ShowPageModule> {
  return resolvePageModule(resource, "Show", options) as Promise<ShowPageModule>;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a handwritten module exists for a resource/view
 */
export function hasHandwrittenModule(
  resourceId: string,
  view: ViewType,
  params?: { mode?: FormMode }
): boolean {
  return getHandwrittenModuleLookupKeys(resourceId, view, params).some((key) =>
    handwrittenModuleMap.has(key)
  );
}

/**
 * Get all resources with handwritten modules
 */
export function getHandwrittenModuleKeys(): string[] {
  return Array.from(handwrittenModuleMap.keys());
}
