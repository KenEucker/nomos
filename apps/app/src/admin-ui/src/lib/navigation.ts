import path from "node:path";
import type { AdminResourceInput } from "./resources/types";
import { getCorePageRoutes, getPluginPageRoutes } from "../integrations/plugin-pages.js";

type NavItem = {
  label: string;
  path: string;
  icon: string;
  order: number;
};

type BuildNavOptions = {
  basePath: string;
  adminUiRoot?: string;
};

type ResourceMeta = {
  label: string;
  icon?: string;
};

const DEFAULT_ICON = "folder";

const normalizePath = (value: string) => value.split(path.sep).join(path.posix.sep);

const stripTrailingSlash = (value: string) => (value.length > 1 ? value.replace(/\/$/, "") : value);

const toTitleCase = (value: string) =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const isDynamicRoute = (route: string) => route.includes("[");

const buildResourceMetadata = () => {
  const resourceModules = import.meta.glob("../pages/**/*.resource.ts", { eager: true });
  const resourceMetadata = new Map<string, ResourceMeta>();

  for (const modulePath of Object.keys(resourceModules)) {
    const mod = resourceModules[modulePath] as Record<string, unknown>;
    const resourceExport = Object.values(mod).find(
      (value) =>
        typeof value === "object" &&
        value !== null &&
        "id" in (value as AdminResourceInput) &&
        "label" in (value as AdminResourceInput)
    ) as AdminResourceInput | undefined;

    if (!resourceExport) continue;

    const label = resourceExport.labelPlural ?? resourceExport.label ?? toTitleCase(resourceExport.id);
    resourceMetadata.set(resourceExport.id, { label, icon: resourceExport.icon });

    if (resourceExport.routeBase) {
      const normalizedRoute = normalizePath(resourceExport.routeBase);
      resourceMetadata.set(normalizedRoute, { label, icon: resourceExport.icon });
    }
  }

  return resourceMetadata;
};

const getResourceMetaForRoute = (
  resourceMetadata: Map<string, ResourceMeta>,
  route: string,
  basePath: string
) => {
  if (resourceMetadata.has(route)) {
    return resourceMetadata.get(route);
  }

  const baseNormalized = stripTrailingSlash(basePath);
  const routeWithBase = route === "/" ? baseNormalized : `${baseNormalized}${route}`;

  if (resourceMetadata.has(routeWithBase)) {
    return resourceMetadata.get(routeWithBase);
  }

  const baseSegment = route.split("/").filter(Boolean)[0];
  if (baseSegment && resourceMetadata.has(baseSegment)) {
    return resourceMetadata.get(baseSegment);
  }

  return undefined;
};

const buildAdminNavOnce = async ({ basePath, adminUiRoot }: BuildNavOptions): Promise<NavItem[]> => {
  const resourceMetadata = buildResourceMetadata();
  const [{ routes: pluginRoutes }, { routes: coreRoutes }] = await Promise.all([
    getPluginPageRoutes({ adminUiRoot }),
    getCorePageRoutes({ adminUiRoot })
  ]);

  const seen = new Set<string>();
  const navItems: NavItem[] = [];

  for (const routeEntry of [...coreRoutes, ...pluginRoutes]) {
    const route = routeEntry.route;
    if (isDynamicRoute(route)) continue;
    if (seen.has(route)) continue;

    seen.add(route);

    const resourceMeta = getResourceMetaForRoute(resourceMetadata, route, basePath);
    const label = resourceMeta?.label ?? (route === "/" ? "Dashboard" : toTitleCase(route.slice(1)));
    const icon = resourceMeta?.icon ?? DEFAULT_ICON;
    const order = route === "/" ? -1 : 0;
    const normalizedBase = stripTrailingSlash(basePath);
    const path = route === "/" ? normalizedBase || "/" : `${normalizedBase}${route}`;

    navItems.push({ label, path, icon, order });
  }

  return navItems.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.label.localeCompare(b.label);
  });
};

let cachedNav: NavItem[] | null = null;

export const buildAdminNav = async (options: BuildNavOptions): Promise<NavItem[]> => {
  if (!import.meta.env.DEV && cachedNav) {
    return cachedNav;
  }

  const nav = await buildAdminNavOnce(options);

  if (!import.meta.env.DEV) {
    cachedNav = nav;
  }

  return nav;
};
