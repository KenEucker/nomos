/**
 * Discover what a plugin will add to the platform (routes, jobs, admin, etc.)
 * by scanning the plugin filesystem and reading the manifest.
 * Used to build a complete PluginPlan for preview (manifest + discovery).
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { filePathToRoute } from "../router/pathMapping";
import { discoverJobsInDirectory } from "../jobs/discovery";
import type { PluginPlan } from "./types";

const ROUTE_METHODS = ["get", "post", "put", "patch", "delete"] as const;

/**
 * Manifest shape we read from for plan discovery (platform plugin manifest).
 * PluginManager's PluginManifest is a subset; at runtime the loaded manifest
 * may include these fields when the plugin exports them.
 */
export type ManifestForPlan = {
  slug?: string;
  name?: string;
  version?: string;
  intents?: string[];
  permissions?: string[];
  adminPages?: Array<{ path: string; label: string }>;
  nav?: Array<{ path: string; label: string }>;
  services?: Record<string, unknown>;
  listeners?: Array<{ event: string }>;
  adminResources?: Array<{ name: string; label: string }>;
};

function collectRouteFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectRouteFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".contract.ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

async function discoverRoutesFromDir(routesDir: string): Promise<PluginPlan["routes"]> {
  const add: Array<{ method: string; path: string }> = [];
  const files = collectRouteFiles(routesDir);

  for (const filePath of files) {
    try {
      const mod = await import(pathToFileURL(filePath).href);
      const routeModule = mod.default ?? mod;
      const routePath = filePathToRoute(filePath, routesDir);

      for (const method of ROUTE_METHODS) {
        const key = method === "delete" ? "del" : method;
        if (routeModule[key]) {
          add.push({
            method: method.toUpperCase(),
            path: routePath,
          });
        }
      }
    } catch {
      // Skip files that fail to load (e.g. non-route modules)
    }
  }

  return { add };
}

async function discoverJobsFromDir(jobsDir: string, namespace: string): Promise<PluginPlan["jobs"]> {
  const { jobs } = await discoverJobsInDirectory(jobsDir, namespace);
  if (jobs.length === 0) return undefined;
  return {
    add: jobs.map((j) => ({ id: j.id, name: j.name, description: j.description })),
  };
}

function planFromManifest(manifest: ManifestForPlan, slug: string): Partial<PluginPlan> {
  const plan: Partial<PluginPlan> = {};

  const permissions = manifest.intents ?? manifest.permissions ?? [];
  if (permissions.length > 0) {
    plan.permissionsRequested = [...permissions];
  }

  if (manifest.adminPages?.length) {
    plan.admin = {
      ...plan.admin,
      pagesAdd: manifest.adminPages.map((p) => ({
        path: p.path,
        title: p.label,
        description: undefined,
      })),
    };
  }

  if (manifest.nav?.length) {
    plan.admin = {
      ...plan.admin,
      menuAdd: manifest.nav.map((m) => ({ label: m.label, path: m.path })),
    };
  }

  if (manifest.services && Object.keys(manifest.services).length > 0) {
    plan.services = Object.keys(manifest.services);
  }

  if (manifest.listeners?.length) {
    plan.listeners = manifest.listeners.map((l) => ({ event: l.event }));
  }

  if (manifest.adminResources?.length) {
    plan.adminResources = manifest.adminResources.map((r) => ({ name: r.name, label: r.label }));
  }

  return plan;
}

export interface DiscoverPlanOptions {
  pluginPath: string;
  slug: string;
  manifest: ManifestForPlan;
}

/**
 * Build a partial PluginPlan from filesystem discovery (routes/, jobs/)
 * and from the plugin manifest (admin, permissions, services, listeners, resources).
 * Does not run the plugin's preview() — that is merged separately in runPreview.
 */
export async function discoverPlanFromPlugin(options: DiscoverPlanOptions): Promise<Partial<PluginPlan>> {
  const { pluginPath, slug, manifest } = options;
  const routesDir = path.join(pluginPath, "routes");
  const jobsDir = path.join(pluginPath, "jobs");

  const [routes, jobs, fromManifest] = await Promise.all([
    discoverRoutesFromDir(routesDir),
    fs.existsSync(jobsDir) ? discoverJobsFromDir(jobsDir, slug) : Promise.resolve(undefined),
    Promise.resolve(planFromManifest(manifest, slug)),
  ]);

  const plan: Partial<PluginPlan> = {
    slug,
    version: manifest.version ?? "0.0.0",
    ...fromManifest,
  };

  if (routes?.add?.length) {
    plan.routes = { add: routes.add, remove: [] };
  }

  if (jobs?.add?.length) {
    plan.jobs = { add: jobs.add };
  }

  return plan;
}
