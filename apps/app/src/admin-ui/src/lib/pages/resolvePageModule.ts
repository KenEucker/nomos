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

import type { ViewType, PageModule, ListPageModule, FormPageModule, ShowPageModule } from "./types";
import { getAllResources, getResource, hasResource } from "../resources/registry";
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
  "../../pages/*/*.ts",
  { eager: false }
);

// Discover Astro page modules that export `pageModule`
// Astro route files live at: pages/<resource>/index.astro
const astroPageModules = import.meta.glob<{ pageModule?: PageModule }>(
  "../../pages/**/index.astro",
  { eager: false }
);

// Normalize paths to resourceId/View format
function normalizeModulePath(path: string): string | null {
  // Expected formats:
  // - ../../pages/<resource>/<View>.ts (relative)
  // - /pages/<resource>/<View>.ts (absolute)
  const match = path.match(/pages\/([^/]+)\/([^/]+)\.ts$/);
  if (!match) return null;
  return `${match[1]}/${match[2]}`;
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
const astroModuleMap = new Map<string, () => Promise<{ pageModule?: PageModule }>>();
let rootAstroLoader: (() => Promise<{ pageModule?: PageModule }>) | null = null;

for (const [path, loader] of Object.entries(astroPageModules)) {
  const match = path.match(/pages\/([^/]+)\/index\.astro$/);
  if (match) {
    astroModuleMap.set(match[1], loader as () => Promise<{ pageModule?: PageModule }>);
    continue;
  }
  if (path.endsWith("/pages/index.astro")) {
    rootAstroLoader = loader as () => Promise<{ pageModule?: PageModule }>;
  }
}

/**
 * Try to load a handwritten module
 */
async function loadHandwrittenModule(
  resourceId: string,
  view: ViewType
): Promise<PageModule | null> {
  const key = `${resourceId}/${view}`;
  const loader = handwrittenModuleMap.get(key);

  if (!loader) {
    if (view === "List") {
      const astroLoader = astroModuleMap.get(resourceId);
      if (astroLoader) {
        try {
          const mod = await astroLoader();
          return mod.pageModule ?? null;
        } catch (error) {
          console.warn(`Failed to load Astro page module for ${resourceId}:`, error);
          return null;
        }
      }
      if (rootAstroLoader) {
        try {
          const mod = await rootAstroLoader();
          if (mod.pageModule?.resourceId === resourceId) {
            return mod.pageModule;
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
    const mod = await loader();
    return mod.default;
  } catch (error) {
    console.warn(`Failed to load handwritten module for ${key}:`, error);
    return null;
  }
}

// ============================================================================
// Module Compiler
// ============================================================================

/**
 * Compile a page module from resource definition
 */
function compileModule(resourceId: string, view: ViewType): PageModule {
  const resource = getResource(resourceId);

  if (!resource) {
    const availableResources = getAllResources().map((item) => item.id);
    throw new PageModuleError(
      `Resource "${resourceId}" not found. Available resources: ${availableResources.join(", ")}`,
      "RESOURCE_NOT_FOUND"
    );
  }

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
  resourceId: string,
  view: ViewType,
  options: ResolveOptions = {}
): Promise<PageModule> {
  // Validate view type
  if (!["List", "Form", "Show"].includes(view)) {
    throw new PageModuleError(
      `Invalid view "${view}". Must be one of: List, Form, Show`,
      "VIEW_INVALID"
    );
  }

  // Validate resource exists
  if (!hasResource(resourceId)) {
    throw new PageModuleError(
      `Resource "${resourceId}" not found`,
      "RESOURCE_NOT_FOUND"
    );
  }

  // Try handwritten module first (unless skipped)
  if (!options.skipHandwritten) {
    const handwritten = await loadHandwrittenModule(resourceId, view);
    if (handwritten) {
      return handwritten;
    }
  }

  // Fall back to compiled module
  return compileModule(resourceId, view);
}

/**
 * Resolve a List page module
 */
export async function resolveListModule(
  resourceId: string,
  options?: ResolveOptions
): Promise<ListPageModule> {
  return resolvePageModule(resourceId, "List", options) as Promise<ListPageModule>;
}

/**
 * Resolve a Form page module
 */
export async function resolveFormModule(
  resourceId: string,
  options?: ResolveOptions
): Promise<FormPageModule> {
  return resolvePageModule(resourceId, "Form", options) as Promise<FormPageModule>;
}

/**
 * Resolve a Show page module
 */
export async function resolveShowModule(
  resourceId: string,
  options?: ResolveOptions
): Promise<ShowPageModule> {
  return resolvePageModule(resourceId, "Show", options) as Promise<ShowPageModule>;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a handwritten module exists for a resource/view
 */
export function hasHandwrittenModule(resourceId: string, view: ViewType): boolean {
  const key = `${resourceId}/${view}`;
  return handwrittenModuleMap.has(key);
}

/**
 * Get all resources with handwritten modules
 */
export function getHandwrittenModuleKeys(): string[] {
  return Array.from(handwrittenModuleMap.keys());
}
