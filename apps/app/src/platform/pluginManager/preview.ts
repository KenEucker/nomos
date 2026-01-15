import type { ResolvedNomosConfig } from "../config/nomos-config";
import type { PluginManifest, PluginPlan, PreviewContext } from "./types";

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
  configKeys: plan.configKeys ?? []
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
  configKeys: [...(base.configKeys ?? []), ...(additions.configKeys ?? [])]
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

  const declare: PreviewContext["declare"] = {
    route: (entry) => collected.routes?.add?.push(entry),
    removeRoute: (entry) => collected.routes?.remove?.push(entry),
    adminPage: (entry) => collected.admin?.pagesAdd?.push(entry),
    adminMenu: (entry) => collected.admin?.menuAdd?.push(entry),
    configKey: (entry) => collected.configKeys?.push(entry),
    permission: (permission) => collected.permissionsRequested?.push(permission),
    warning: (warning) => collected.warnings?.push(warning)
  };

  return { collected, declare };
};

const freeze = <T>(value: T): T => {
  Object.freeze(value);
  return value;
};

export const runPreview = async (
  manifest: PluginManifest,
  config: ResolvedNomosConfig
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

  return { plan: merged, warnings };
};
