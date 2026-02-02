import type { ResolvedNomosConfig } from "../config/nomos-config";
import type { PluginManifest, PluginPlan, PreviewContext } from "./types";
import { discoverPlanFromPlugin } from "./discoverPlan";
import type { ManifestForPlan } from "./discoverPlan";

type PreviewResult = {
  plan: PluginPlan;
  warnings: string[];
};

const emptyPlanArrays = (): PluginPlan => ({
  slug: "",
  version: "",
  warnings: [],
  permissionsRequested: [],
  routes: { add: [], remove: [] },
  jobs: { add: [] },
  admin: { pagesAdd: [], menuAdd: [] },
  services: [],
  listeners: [],
  adminResources: [],
  configKeys: [],
  tables: [],
});

const normalizePlan = (plan: Partial<PluginPlan> & { slug: string; version: string }): PluginPlan => ({
  slug: plan.slug,
  version: plan.version,
  summary: plan.summary,
  warnings: plan.warnings ?? [],
  permissionsRequested: plan.permissionsRequested ?? [],
  routes: {
    add: plan.routes?.add ?? [],
    remove: plan.routes?.remove ?? [],
  },
  jobs: {
    add: plan.jobs?.add ?? [],
  },
  admin: {
    pagesAdd: plan.admin?.pagesAdd ?? [],
    menuAdd: plan.admin?.menuAdd ?? [],
  },
  services: plan.services ?? [],
  listeners: plan.listeners ?? [],
  adminResources: plan.adminResources ?? [],
  configKeys: plan.configKeys ?? [],
  tables: plan.tables ?? [],
});

const mergePlans = (base: PluginPlan, additions: Partial<PluginPlan>): PluginPlan => {
  const routeAdd = [
    ...(base.routes?.add ?? []),
    ...(additions.routes?.add ?? []),
  ];
  const routeAddKey = (r: { method: string; path: string }) => `${r.method}:${r.path}`;
  const seenRoutes = new Set<string>();
  const dedupedRouteAdd = routeAdd.filter((r) => {
    const key = routeAddKey(r);
    if (seenRoutes.has(key)) return false;
    seenRoutes.add(key);
    return true;
  });

  const jobAdd = [...(base.jobs?.add ?? []), ...(additions.jobs?.add ?? [])];
  const seenJobs = new Set<string>();
  const dedupedJobAdd = jobAdd.filter((j) => {
    if (seenJobs.has(j.id)) return false;
    seenJobs.add(j.id);
    return true;
  });

  return {
    ...base,
    summary: additions.summary ?? base.summary,
    warnings: [...(base.warnings ?? []), ...(additions.warnings ?? [])],
    permissionsRequested: [
      ...new Set([...(base.permissionsRequested ?? []), ...(additions.permissionsRequested ?? [])]),
    ],
    routes: {
      add: dedupedRouteAdd,
      remove: [...(base.routes?.remove ?? []), ...(additions.routes?.remove ?? [])],
    },
    jobs: { add: dedupedJobAdd },
    admin: {
      pagesAdd: mergeByPath(base.admin?.pagesAdd ?? [], additions.admin?.pagesAdd ?? [], "path"),
      menuAdd: mergeByPath(base.admin?.menuAdd ?? [], additions.admin?.menuAdd ?? [], "path"),
    },
    services: [...new Set([...(base.services ?? []), ...(additions.services ?? [])])],
    listeners: mergeByPath(base.listeners ?? [], additions.listeners ?? [], "event"),
    adminResources: mergeByPath(base.adminResources ?? [], additions.adminResources ?? [], "name"),
    configKeys: [...(base.configKeys ?? []), ...(additions.configKeys ?? [])],
    tables: mergeByPath(base.tables ?? [], additions.tables ?? [], "name"),
  };
};

function mergeByPath<T extends Record<string, unknown>>(
  base: T[],
  add: T[],
  key: keyof T
): T[] {
  const seen = new Set(base.map((b) => String(b[key])));
  const result = [...base];
  for (const a of add) {
    const k = String(a[key]);
    if (!seen.has(k)) {
      seen.add(k);
      result.push(a);
    }
  }
  return result;
}

  const createPlanCollector = (slug: string, version: string) => {
  const collected = emptyPlanArrays();
  collected.slug = slug;
  collected.version = version;

  const declaredTables: Array<{ name: string; description?: string }> = [];
  collected.tables = declaredTables;

  const declare: PreviewContext["declare"] = {
    route: (entry) => collected.routes?.add?.push(entry),
    removeRoute: (entry) => collected.routes?.remove?.push(entry),
    job: (entry) => collected.jobs?.add?.push(entry),
    adminPage: (entry) => collected.admin?.pagesAdd?.push(entry),
    adminMenu: (entry) => collected.admin?.menuAdd?.push(entry),
    service: (name) => {
      if (name && !collected.services?.includes(name)) collected.services?.push(name);
    },
    listener: (entry) => collected.listeners?.push(entry),
    adminResource: (entry) => collected.adminResources?.push(entry),
    configKey: (entry) => collected.configKeys?.push(entry),
    permission: (permission) => collected.permissionsRequested?.push(permission),
    warning: (warning) => collected.warnings?.push(warning),
    table: (entry) => declaredTables.push(entry),
  };

  return { collected, declare, declaredTables };
};

const freeze = <T>(value: T): T => {
  Object.freeze(value);
  return value;
};

export type RunPreviewOptions = {
  /** Plugin root path (e.g. plugins/users) for filesystem discovery of routes and jobs */
  pluginPath?: string;
  /** Plugin slug for namespacing discovered jobs */
  slug?: string;
  /** Full platform manifest shape for manifest-derived plan (admin, permissions, services, etc.) */
  platformManifest?: ManifestForPlan;
};

export const runPreview = async (
  manifest: PluginManifest,
  config: ResolvedNomosConfig,
  options?: RunPreviewOptions
): Promise<PreviewResult> => {
  const sandbox = config.modules.pluginManager.sandbox;
  if (sandbox.mode === "isolated") {
    throw new Error("Isolated sandbox mode is not implemented yet.");
  }

  const slug = options?.slug ?? manifest.slug ?? manifest.name ?? "";
  const version = manifest.version ?? "0.0.0";

  // 1. Build plan from filesystem discovery + manifest (part of the truth)
  let plan: PluginPlan = emptyPlanArrays();
  plan.slug = slug;
  plan.version = version;

  if (options?.pluginPath && options?.slug) {
    const platformManifest = options.platformManifest ?? (manifest as unknown as ManifestForPlan);
    const discovered = await discoverPlanFromPlugin({
      pluginPath: options.pluginPath,
      slug: options.slug,
      manifest: platformManifest,
    });
    plan = mergePlans(normalizePlan({ ...plan, ...discovered }), {});
  }

  // 2. If plugin has preview(), run it and merge (declarative part of the truth)
  if (manifest.preview) {
    const { collected, declare, declaredTables } = createPlanCollector(slug, version);

    const ctx: PreviewContext = freeze({
      env: freeze({ nodeEnv: config.app.env }),
      config: freeze({
        appName: config.app.name,
        modules: freeze({
          adminEnabled: config.modules.admin.enabled,
          authEnabled: config.modules.auth.enabled,
        }),
      }),
      declare: freeze(declare),
    });

    const previewPlan = await manifest.preview(ctx);
    const declared = normalizePlan({
      ...(previewPlan ?? { slug, version }),
      slug,
      version,
      permissionsRequested: previewPlan?.permissionsRequested ?? manifest.permissions ?? [],
    });
    plan = mergePlans(plan, mergePlans(declared, collected));
  }

  plan = normalizePlan(plan);

  const warnings: string[] = [];
  if (sandbox.mode === "restricted") {
    warnings.push(
      `Preview executed in restricted mode (best-effort). Network: ${sandbox.network}. Filesystem: ${sandbox.filesystem}.`
    );
  }
  if (sandbox.mode === "none") {
    warnings.push("Preview executed without sandbox restrictions.");
  }
  plan.warnings = [...(plan.warnings ?? []), ...warnings];

  return { plan, warnings };
};
