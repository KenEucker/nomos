import path from "node:path";
import type { ResourceDefinition, PanelModule } from "./types";

export type NavItem = {
  label: string;
  path: string;
  icon: string;
  order?: number;
  group?: string;
};

type BuildNavOptions = {
  basePath: string;
  enabledPluginSlugs?: Set<string>;
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
  const coreResourceModules = import.meta.glob("../pages/**/*.resource.ts", { eager: true });
  const pluginResourceModules = import.meta.glob("../../../plugins/**/pages/**/*.resource.ts", { eager: true });
  const resourceMetadata = new Map<string, ResourceMeta>();

  for (const modulePath of Object.keys({ ...coreResourceModules, ...pluginResourceModules })) {
    const mod = coreResourceModules[modulePath] || pluginResourceModules[modulePath];
    const resourceExport = Object.values(mod as Record<string, unknown>).find(
      (value) =>
        typeof value === "object" &&
        value !== null &&
        "name" in (value as ResourceDefinition) &&
        ("label" in (value as ResourceDefinition) || "labels" in (value as ResourceDefinition))
    ) as ResourceDefinition | undefined;

    if (!resourceExport) continue;

    const label =
      "labels" in resourceExport && resourceExport.labels
        ? resourceExport.labels.labelPlural
        : resourceExport.labelPlural ?? resourceExport.label ?? toTitleCase(resourceExport.name);
    const icon = resourceExport.menu?.icon;
    const order = resourceExport.menu?.order;
    const group = resourceExport.menu?.group;

    resourceMetadata.set(resourceExport.name, {
      label,
      icon,
      order,
      group
    });

    if (resourceExport.name === "dashboard") {
      resourceMetadata.set("/", { label, icon, order, group });
    }
  }

  return resourceMetadata;
};

const routeFromPanelFilePath = (filePath: string) => {
  const normalized = normalizePath(filePath);
  const markerIndex = normalized.lastIndexOf("/pages/");

  if (markerIndex === -1) return null;

  const relativePath = normalized.slice(markerIndex + "/pages/".length);
  if (!relativePath.endsWith(".panel.ts")) return null;

  const withoutExtension = relativePath.slice(0, -".panel.ts".length);
  const segments = withoutExtension.split("/").filter(Boolean);

  if (segments[segments.length - 1] === "index") {
    segments.pop();
  }

  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
};

const buildPanelMetadata = () => {
  const corePanelModules = import.meta.glob("../pages/**/*.panel.ts", { eager: true });
  const pluginPanelModules = import.meta.glob("../../../plugins/**/pages/**/*.panel.ts", { eager: true });
  const panelMetadata = new Map<string, ResourceMeta>();

  for (const modulePath of Object.keys({ ...corePanelModules, ...pluginPanelModules })) {
    const mod = corePanelModules[modulePath] || pluginPanelModules[modulePath];
    const panelExport = Object.values(mod as Record<string, unknown>).find(
      (value) =>
        typeof value === "object" &&
        value !== null &&
        "id" in (value as PanelModule) &&
        "title" in (value as PanelModule)
    ) as PanelModule | undefined;

    if (!panelExport || !panelExport.menu) continue;

    const route = routeFromPanelFilePath(modulePath);
    if (!route) continue;

    const label = panelExport.menu.label ?? panelExport.title;
    const icon = panelExport.menu.icon;
    const order = panelExport.menu.order;
    const group = panelExport.menu.group;

    panelMetadata.set(route, {
      label,
      icon,
      order,
      group
    });
  }

  return panelMetadata;
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

const getPanelMetaForRoute = (
  panelMetadata: Map<string, ResourceMeta>,
  route: string,
  basePath: string
) => {
  if (panelMetadata.has(route)) {
    return panelMetadata.get(route);
  }

  const baseNormalized = stripTrailingSlash(basePath);
  const routeWithBase = route === "/" ? baseNormalized : `${baseNormalized}${route}`;

  if (panelMetadata.has(routeWithBase)) {
    return panelMetadata.get(routeWithBase);
  }

  const baseSegment = route.split("/").filter(Boolean)[0];
  if (baseSegment && panelMetadata.has(baseSegment)) {
    return panelMetadata.get(baseSegment);
  }

  return undefined;
};

const getMetaForRoute = (
  resourceMetadata: Map<string, ResourceMeta>,
  panelMetadata: Map<string, ResourceMeta>,
  route: string,
  basePath: string
) => {
  // Priority: ResourceDefinition menu metadata > PanelModule menu metadata
  const resourceMeta = getResourceMetaForRoute(resourceMetadata, route, basePath);
  if (resourceMeta) {
    return resourceMeta;
  }

  return getPanelMetaForRoute(panelMetadata, route, basePath);
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

const getPluginSlugFromPath = (filePath: string): string | null => {
  const normalized = normalizePath(filePath);
  const match = normalized.match(/\/plugins\/([^/]+)\/pages\//);
  return match ? match[1] : null;
};

const buildAdminNavOnce = ({ basePath, enabledPluginSlugs }: BuildNavOptions): NavItem[] => {
  const resourceMetadata = buildResourceMetadata();
  const panelMetadata = buildPanelMetadata();
  const corePages = import.meta.glob("../pages/**/*.astro", { eager: true });
  const pluginPages = import.meta.glob("../../../plugins/**/pages/**/*.astro", { eager: true });
  
  // Filter plugin pages to only include enabled plugins
  const pluginPageEntries = enabledPluginSlugs
    ? Object.keys(pluginPages).filter((filePath) => {
        const slug = getPluginSlugFromPath(filePath);
        return slug ? enabledPluginSlugs.has(slug) : false;
      })
    : Object.keys(pluginPages);
  
  const entries = Object.keys(corePages).concat(pluginPageEntries);

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

    const meta = getMetaForRoute(resourceMetadata, panelMetadata, topRoute, basePath);
    const label = meta?.label ?? (topRoute === "/" ? "Dashboard" : toTitleCase(topRoute.slice(1)));
    const icon = meta?.icon ?? DEFAULT_ICON;
    const order = meta?.order ?? (topRoute === "/" ? -1 : undefined);
    const group = meta?.group;
    const normalizedBase = stripTrailingSlash(basePath);
    const path = topRoute === "/" ? normalizedBase || "/" : `${normalizedBase}${topRoute}`;

    navItems.push({ label, path, icon, order, group });
  }

  return navItems.sort((a, b) => {
    const aHasOrder = typeof a.order === "number";
    const bHasOrder = typeof b.order === "number";

    if (aHasOrder && bHasOrder && a.order !== b.order) {
      return a.order! - b.order!;
    }

    if (aHasOrder !== bHasOrder) {
      return aHasOrder ? -1 : 1;
    }

    return a.label.localeCompare(b.label);
  });
};

let cachedNav: NavItem[] | null = null;

export const buildAdminNav = (options: BuildNavOptions): NavItem[] => {
  // Don't cache if enabledPluginSlugs is provided (plugin state may change)
  const shouldCache = !import.meta.env.DEV && !options.enabledPluginSlugs;
  
  if (shouldCache && cachedNav) {
    return cachedNav;
  }

  const nav = buildAdminNavOnce(options);

  if (shouldCache) {
    cachedNav = nav;
  }

  return nav;
};
