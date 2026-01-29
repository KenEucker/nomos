import type { PrismaClient } from "@prisma/client";
import type { ResolvedNomosConfig } from "../config/nomos-config";
import type { PluginManifest, PluginPlan, PreviewContext } from "./types";
import { validateSchema, previewSchema } from "../db/pluginSchema";

type PreviewResult = {
  plan: PluginPlan;
  warnings: string[];
};

const normalizePlan = (plan: PluginPlan): PluginPlan => ({
  slug: plan.slug,
  version: plan.version,
  summary: plan.summary,
  warnings: plan.warnings ?? [],
  permissionsRequested: plan.permissionsRequested ?? [],
  routes: {
    add: plan.routes?.add ?? [],
    remove: plan.routes?.remove ?? []
  },
  admin: {
    pagesAdd: plan.admin?.pagesAdd ?? [],
    menuAdd: plan.admin?.menuAdd ?? []
  },
  configKeys: plan.configKeys ?? [],
  database: plan.database
});

const mergePlans = (base: PluginPlan, additions: PluginPlan): PluginPlan => ({
  ...base,
  summary: additions.summary ?? base.summary,
  warnings: [...(base.warnings ?? []), ...(additions.warnings ?? [])],
  permissionsRequested: [
    ...(base.permissionsRequested ?? []),
    ...(additions.permissionsRequested ?? [])
  ],
  routes: {
    add: [...(base.routes?.add ?? []), ...(additions.routes?.add ?? [])],
    remove: [...(base.routes?.remove ?? []), ...(additions.routes?.remove ?? [])]
  },
  admin: {
    pagesAdd: [...(base.admin?.pagesAdd ?? []), ...(additions.admin?.pagesAdd ?? [])],
    menuAdd: [...(base.admin?.menuAdd ?? []), ...(additions.admin?.menuAdd ?? [])]
  },
  configKeys: [...(base.configKeys ?? []), ...(additions.configKeys ?? [])],
  database: additions.database ?? base.database
});

const createPlanCollector = (slug: string, version: string) => {
  const collected: PluginPlan = {
    slug,
    version,
    warnings: [],
    permissionsRequested: [],
    routes: { add: [], remove: [] },
    admin: { pagesAdd: [], menuAdd: [] },
    configKeys: []
  };

  const declaredTables: Array<{ name: string; description?: string }> = [];

  const declare: PreviewContext["declare"] = {
    route: (entry) => collected.routes?.add?.push(entry),
    removeRoute: (entry) => collected.routes?.remove?.push(entry),
    adminPage: (entry) => collected.admin?.pagesAdd?.push(entry),
    adminMenu: (entry) => collected.admin?.menuAdd?.push(entry),
    configKey: (entry) => collected.configKeys?.push(entry),
    permission: (permission) => collected.permissionsRequested?.push(permission),
    warning: (warning) => collected.warnings?.push(warning),
    table: (entry) => declaredTables.push(entry)
  };

  return { collected, declare, declaredTables };
};

const freeze = <T>(value: T): T => {
  Object.freeze(value);
  return value;
};

/**
 * Run a plugin's preview function and optionally compute the database
 * schema diff if the plugin declares a `database` property.
 *
 * @param manifest  The plugin manifest.
 * @param config    Resolved nomos config.
 * @param prisma    Optional Prisma client — required for database preview.
 *                  If omitted, database preview is skipped.
 */
export const runPreview = async (
  manifest: PluginManifest,
  config: ResolvedNomosConfig,
  prisma?: PrismaClient
): Promise<PreviewResult> => {
  if (!manifest.preview) {
    throw new Error("Plugin does not export a preview() function.");
  }

  const sandbox = config.modules.pluginManager.sandbox;
  if (sandbox.mode === "isolated") {
    throw new Error("Isolated sandbox mode is not implemented yet.");
  }

  const { collected, declare } = createPlanCollector(
    manifest.slug ?? manifest.name,
    manifest.version
  );

  const ctx: PreviewContext = freeze({
    env: freeze({ nodeEnv: config.app.env }),
    config: freeze({
      appName: config.app.name,
      modules: freeze({
        adminEnabled: config.modules.admin.enabled,
        authEnabled: config.modules.auth.enabled
      })
    }),
    declare: freeze(declare)
  });

  const warnings: string[] = [];
  if (sandbox.mode === "restricted") {
    // TODO: Replace best-effort restricted policy with true isolation (vm/worker sandbox).
    warnings.push(
      `Preview executed in restricted mode (best-effort). Network: ${sandbox.network}. Filesystem: ${sandbox.filesystem}.`
    );
  }
  if (sandbox.mode === "none") {
    warnings.push("Preview executed without sandbox restrictions.");
  }

  const previewPlan = await manifest.preview(ctx);
  const normalized = normalizePlan({
    ...(previewPlan ?? { slug: collected.slug, version: collected.version }),
    slug: manifest.slug ?? collected.slug,
    version: manifest.version,
    permissionsRequested: previewPlan?.permissionsRequested ?? manifest.permissions ?? []
  });

  const merged = normalizePlan(mergePlans(normalized, collected));
  merged.warnings = [...(merged.warnings ?? []), ...warnings];

  // Database schema: validate unconditionally when manifest.database exists
  if (manifest.database) {
    const pluginSlug = manifest.slug ?? manifest.name;
    const validation = validateSchema(pluginSlug, manifest.database);

    merged.database = {
      validationIssues: validation.issues.map((i) => ({
        severity: i.severity,
        message: i.message,
        code: i.code,
      })),
    };
    if (!validation.valid) {
      merged.warnings?.push(
        `Database schema has ${validation.issues.filter((i) => i.severity === "error").length} validation error(s). ` +
          `Fix these before enabling the plugin.`
      );
    }

    // Compute diff only when prisma is available
    if (prisma) {
      try {
        const diff = await previewSchema(prisma, pluginSlug, manifest.database);
        merged.database = { ...merged.database, diff };
        if (diff.hasChanges) {
          merged.warnings?.push(
            `Database changes: ${diff.summary.join(" ")}`
          );
        }
        if (diff.warnings.length > 0) {
          merged.warnings?.push(...diff.warnings);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        merged.warnings?.push(
          `Database schema preview failed: ${message}. ` +
            `The plugin's schema definition may reference tables that don't exist yet.`
        );
      }
    }
  }

  return { plan: merged, warnings };
};
