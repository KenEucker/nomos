import path from "node:path";
import type { AdminResourceInput } from "./resources/types";

type NavItem = {
  label: string;
  path: string;
  icon: string;
  order?: number;
  group?: string;
};

type BuildNavOptions = {
  basePath: string;
};

type ResourceMeta = {
  label: string;
  icon?: string;
  order?: number;
  group?: string;
};

const DEFAULT_ICON =
  '<svg class="flex-shrink-0 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>';

const normalizePath = (value: string) => value.split(path.sep).join(path.posix.sep);

const stripTrailingSlash = (value: string) => (value.length > 1 ? value.replace(/\/$/, "") : value);

const toTitleCase = (value: string) =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const isDynamicRoute = (route: string) => route.includes("[");

const getTopLevelRoute = (route: string) => {
  if (route === "/") return "/";
  const [segment] = route.split("/").filter(Boolean);
  return segment ? `/${segment}` : "/";
};

const EXCLUDED_ROUTES = new Set(["/login"]);

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
    resourceMetadata.set(resourceExport.id, {
      label,
      icon: resourceExport.icon,
      order: resourceExport.menuOrder,
      group: resourceExport.menuGroup
    });

    if (resourceExport.routeBase) {
      const normalizedRoute = normalizePath(resourceExport.routeBase);
      resourceMetadata.set(normalizedRoute, {
        label,
        icon: resourceExport.icon,
        order: resourceExport.menuOrder,
        group: resourceExport.menuGroup
      });
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

const routeFromFilePath = (filePath: string) => {
  const normalized = normalizePath(filePath);
  const markerIndex = normalized.lastIndexOf("/pages/");

  if (markerIndex === -1) return null;

  const relativePath = normalized.slice(markerIndex + "/pages/".length);
  if (!relativePath.endsWith(".astro")) return null;

  const withoutExtension = relativePath.slice(0, -".astro".length);
  const segments = withoutExtension.split("/").filter(Boolean);

  if (segments[segments.length - 1] === "index") {
    segments.pop();
  }

  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
};

const buildAdminNavOnce = ({ basePath }: BuildNavOptions): NavItem[] => {
  const resourceMetadata = buildResourceMetadata();
  const corePages = import.meta.glob("../pages/**/*.astro", { eager: true });
  const pluginPages = import.meta.glob("../../../plugins/**/pages/**/*.astro", { eager: true });
  const entries = Object.keys({ ...corePages, ...pluginPages });

  const indexRoutes = new Set(
    entries
      .filter((filePath) => path.basename(filePath) === "index.astro")
      .map((filePath) => routeFromFilePath(filePath))
      .filter((route): route is string => Boolean(route))
  );

  const seen = new Set<string>();
  const navItems: NavItem[] = [];

  for (const route of indexRoutes) {
    const topRoute = getTopLevelRoute(route);

    if (EXCLUDED_ROUTES.has(topRoute)) continue;
    if (topRoute !== route) continue;
    if (seen.has(topRoute)) continue;

    if (isDynamicRoute(route)) continue;

    seen.add(topRoute);

    const resourceMeta = getResourceMetaForRoute(resourceMetadata, topRoute, basePath);
    const label = resourceMeta?.label ?? (topRoute === "/" ? "Dashboard" : toTitleCase(topRoute.slice(1)));
    const icon = resourceMeta?.icon ?? DEFAULT_ICON;
    const order = resourceMeta?.order ?? (topRoute === "/" ? -1 : undefined);
    const group = resourceMeta?.group;
    const normalizedBase = stripTrailingSlash(basePath);
    const path = topRoute === "/" ? normalizedBase || "/" : `${normalizedBase}${topRoute}`;

    navItems.push({ label, path, icon, order, group });
  }

  return navItems.sort((a, b) => {
    const aHasOrder = typeof a.order === "number";
    const bHasOrder = typeof b.order === "number";

    if (aHasOrder && bHasOrder && a.order !== b.order) {
      return a.order - b.order;
    }

    if (aHasOrder !== bHasOrder) {
      return aHasOrder ? -1 : 1;
    }

    return a.label.localeCompare(b.label);
  });
};

let cachedNav: NavItem[] | null = null;

export const buildAdminNav = (options: BuildNavOptions): NavItem[] => {
  if (!import.meta.env.DEV && cachedNav) {
    return cachedNav;
  }

  const nav = buildAdminNavOnce(options);

  if (!import.meta.env.DEV) {
    cachedNav = nav;
  }

  return nav;
};
