/**
 * Nomos Jobs Discovery
 *
 * Filesystem-based job discovery following the specification:
 * - plugins/{plugin-name}/jobs/**.ts
 * - platform/{core-module}/jobs/**.ts
 *
 * Identity is derived from filesystem structure:
 * - name: derived from filename (without extension)
 * - namespace: derived from plugin name or core module name
 * - id: {namespace}.{name}
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { JobDefinition, ResolvedJobDefinition } from "./types";

/**
 * Result of job discovery
 */
export interface DiscoveryResult {
  jobs: ResolvedJobDefinition[];
  errors: DiscoveryError[];
}

/**
 * Error encountered during discovery
 */
export interface DiscoveryError {
  path: string;
  message: string;
  error?: Error;
}

/**
 * Options for job discovery
 */
export interface DiscoveryOptions {
  /** Base directory (usually the src directory) */
  baseDir: string;
  /** Additional paths to scan for jobs */
  additionalPaths?: string[];
  /** Whether to throw on first error or collect all errors */
  failFast?: boolean;
}

/**
 * Extract the job name from a filename
 * e.g., "cleanup-temp-files.ts" -> "cleanup-temp-files"
 * e.g., "prune-events.job.ts" -> "prune-events"
 */
function extractJobName(filename: string): string {
  // Remove .ts extension
  let name = filename.replace(/\.ts$/, "");
  // Remove .job suffix if present
  name = name.replace(/\.job$/, "");
  return name;
}

/**
 * Humanize a job name for display
 * e.g., "cleanup-temp-files" -> "Cleanup Temp Files"
 */
export function humanizeJobName(name: string): string {
  return name
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Recursively find all .ts files in a directory
 */
async function findJobFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Recursively search subdirectories
      const subResults = await findJobFiles(fullPath);
      results.push(...subResults);
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      // Skip test files and type definition files
      if (
        !entry.name.endsWith(".test.ts") &&
        !entry.name.endsWith(".spec.ts") &&
        !entry.name.endsWith(".d.ts")
      ) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Load and validate a job module
 */
async function loadJobModule(
  filePath: string,
  namespace: string,
  errors: DiscoveryError[]
): Promise<ResolvedJobDefinition | null> {
  try {
    const fileUrl = pathToFileURL(filePath).href;
    const module = await import(fileUrl);

    // Look for the job definition
    // Prefer default export, then look for named exports
    let definition: JobDefinition | undefined;

    if (module.default && typeof module.default === "object") {
      // Check if it's a JobDefinition (has handler and triggers)
      if (module.default.handler && module.default.triggers) {
        definition = module.default;
      } else if (module.default.default?.handler && module.default.default?.triggers) {
        // Handle double-default from some module systems
        definition = module.default.default;
      }
    }

    // If no default, look for named exports
    if (!definition) {
      for (const [key, value] of Object.entries(module)) {
        if (
          key !== "default" &&
          value &&
          typeof value === "object" &&
          (value as JobDefinition).handler &&
          (value as JobDefinition).triggers
        ) {
          if (definition) {
            errors.push({
              path: filePath,
              message: `Multiple job definitions found. Each job module should export a single JobDefinition.`,
            });
            return null;
          }
          definition = value as JobDefinition;
        }
      }
    }

    if (!definition) {
      errors.push({
        path: filePath,
        message: `No valid JobDefinition found. Module must export an object with 'handler' and 'triggers'.`,
      });
      return null;
    }

    // Validate required fields
    if (typeof definition.handler !== "function") {
      errors.push({
        path: filePath,
        message: `Invalid handler: must be a function.`,
      });
      return null;
    }

    if (!definition.triggers || typeof definition.triggers !== "object") {
      errors.push({
        path: filePath,
        message: `Invalid triggers: must be an object.`,
      });
      return null;
    }

    if (!definition.execution || typeof definition.execution.timeoutMs !== "number") {
      errors.push({
        path: filePath,
        message: `Invalid execution config: timeoutMs is required.`,
      });
      return null;
    }

    // Derive identity from filesystem
    const filename = path.basename(filePath);
    const name = definition.name ?? extractJobName(filename);
    const id = definition.id ?? `${namespace}.${name}`;

    // Build the resolved definition
    const resolved: ResolvedJobDefinition = {
      id,
      name,
      namespace: definition.namespace ?? namespace,
      modulePath: filePath,
      enabled: true,
      description: definition.description,
      triggers: definition.triggers,
      execution: definition.execution,
      runner: definition.runner ?? { isolation: "thread" },
      handler: definition.handler,
      observability: definition.observability,
      ui: definition.ui,
    };

    return resolved;
  } catch (error) {
    errors.push({
      path: filePath,
      message: `Failed to load job module: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error : undefined,
    });
    return null;
  }
}

/**
 * Discover jobs from plugin directories
 */
async function discoverPluginJobs(
  baseDir: string,
  errors: DiscoveryError[]
): Promise<ResolvedJobDefinition[]> {
  const jobs: ResolvedJobDefinition[] = [];
  const pluginsDir = path.join(baseDir, "plugins");

  if (!fs.existsSync(pluginsDir)) {
    return jobs;
  }

  const pluginDirs = await fs.promises.readdir(pluginsDir, { withFileTypes: true });

  for (const entry of pluginDirs) {
    if (!entry.isDirectory()) continue;

    const pluginName = entry.name;
    const jobsDir = path.join(pluginsDir, pluginName, "jobs");

    if (!fs.existsSync(jobsDir)) continue;

    const jobFiles = await findJobFiles(jobsDir);

    for (const filePath of jobFiles) {
      const job = await loadJobModule(filePath, pluginName, errors);
      if (job) {
        jobs.push(job);
      }
    }
  }

  return jobs;
}

/**
 * Discover jobs from platform/core module directories
 */
async function discoverPlatformJobs(
  baseDir: string,
  errors: DiscoveryError[]
): Promise<ResolvedJobDefinition[]> {
  const jobs: ResolvedJobDefinition[] = [];
  const platformDir = path.join(baseDir, "platform");

  if (!fs.existsSync(platformDir)) {
    return jobs;
  }

  const moduleDirs = await fs.promises.readdir(platformDir, { withFileTypes: true });

  for (const entry of moduleDirs) {
    if (!entry.isDirectory()) continue;

    const moduleName = entry.name;
    const jobsDir = path.join(platformDir, moduleName, "jobs");

    if (!fs.existsSync(jobsDir)) continue;

    const jobFiles = await findJobFiles(jobsDir);

    for (const filePath of jobFiles) {
      const job = await loadJobModule(filePath, moduleName, errors);
      if (job) {
        jobs.push(job);
      }
    }
  }

  return jobs;
}

/**
 * Discover all jobs from filesystem
 */
export async function discoverJobs(options: DiscoveryOptions): Promise<DiscoveryResult> {
  const errors: DiscoveryError[] = [];
  const jobs: ResolvedJobDefinition[] = [];

  // Discover plugin jobs
  const pluginJobs = await discoverPluginJobs(options.baseDir, errors);
  jobs.push(...pluginJobs);

  // Discover platform jobs
  const platformJobs = await discoverPlatformJobs(options.baseDir, errors);
  jobs.push(...platformJobs);

  // Discover from additional paths
  if (options.additionalPaths) {
    for (const additionalPath of options.additionalPaths) {
      if (!fs.existsSync(additionalPath)) continue;

      // Determine namespace from path
      const parts = additionalPath.split(path.sep);
      const jobsIndex = parts.lastIndexOf("jobs");
      const namespace = jobsIndex > 0 ? parts[jobsIndex - 1] : "custom";

      const jobFiles = await findJobFiles(additionalPath);

      for (const filePath of jobFiles) {
        const job = await loadJobModule(filePath, namespace, errors);
        if (job) {
          jobs.push(job);
        }
      }
    }
  }

  // Check for duplicate job IDs
  const seenIds = new Map<string, string>();
  const validJobs: ResolvedJobDefinition[] = [];

  for (const job of jobs) {
    const existingPath = seenIds.get(job.id);
    if (existingPath) {
      errors.push({
        path: job.modulePath,
        message: `Duplicate job ID "${job.id}". Also defined at: ${existingPath}`,
      });
    } else {
      seenIds.set(job.id, job.modulePath);
      validJobs.push(job);
    }
  }

  if (options.failFast && errors.length > 0) {
    throw new Error(
      `Job discovery failed:\n${errors.map((e) => `  - ${e.path}: ${e.message}`).join("\n")}`
    );
  }

  return { jobs: validJobs, errors };
}

/**
 * Lightweight result for plugin preview (id, name, description only).
 */
export interface JobPlanEntry {
  id: string;
  name?: string;
  description?: string;
}

/**
 * Discover jobs from a single directory (e.g. plugins/<slug>/jobs).
 * Used by plugin preview to list jobs a plugin will add without full runtime registration.
 */
export async function discoverJobsInDirectory(
  jobsDir: string,
  namespace: string
): Promise<{ jobs: JobPlanEntry[]; errors: DiscoveryError[] }> {
  const errors: DiscoveryError[] = [];
  const jobFiles = await findJobFiles(jobsDir);
  const jobs: JobPlanEntry[] = [];

  for (const filePath of jobFiles) {
    const job = await loadJobModule(filePath, namespace, errors);
    if (job) {
      jobs.push({
        id: job.id,
        name: job.name,
        description: job.description,
      });
    }
  }

  return { jobs, errors };
}
