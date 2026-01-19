import type { MiddlewareHandler } from "astro";
import path from "node:path";
import { requireAdminSession } from "./lib/server/session";
import { serverApiGet, ServerApiError } from "./lib/server/api";
import { computeCapabilities } from "./lib/authz/capabilities.server";
import type { SessionUser } from "./lib/session";

const resolveBasePath = () => {
  const baseUrl = import.meta.env.BASE_URL ?? "/";
  if (baseUrl === "/") return "/";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
};

const isHtmlRequest = (request: Request) => {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html");
};

const normalizePath = (value: string) => value.split(path.sep).join(path.posix.sep);

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

const pluginRouteMap = (() => {
  const pluginPages = import.meta.glob("../../plugins/**/pages/**/*.astro", { eager: true });
  const map = new Map<string, string>();
  for (const filePath of Object.keys(pluginPages)) {
    const match = filePath.match(/\/plugins\/([^/]+)\/pages\//);
    if (!match) continue;
    const slug = match[1];
    const route = routeFromFilePath(filePath);
    if (!route) continue;
    map.set(route, slug);
  }
  return map;
})();

const resolvePluginSlug = (pathname: string, basePath: string) => {
  const normalized = basePath === "/" ? pathname : pathname.replace(basePath, "") || "/";
  return pluginRouteMap.get(normalized);
};

const resolveSubjectLevel = (roles: string[]) => {
  if (roles.includes("platform_admin") || roles.includes("admin")) return "admin";
  if (roles.includes("editor")) return "manager";
  return "viewer";
};

const buildAuthPayload = (user: SessionUser) => {
  const level = resolveSubjectLevel(user.roles);
  const subject = {
    id: user.id,
    name: user.name,
    email: user.email,
    level,
    roles: user.roles
  };
  return {
    subject,
    capabilities: computeCapabilities(subject)
  };
};

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { request, url } = context;
  const basePath = resolveBasePath();
  const pathname = url.pathname;

  if (request.method !== "GET" && request.method !== "HEAD") {
    return next();
  }

  if (!isHtmlRequest(request)) {
    return next();
  }

  const loginPath = basePath === "/" ? "/login" : `${basePath}/login`;
  if (pathname === loginPath || pathname === `${loginPath}/`) {
    return next();
  }

  const assetPrefix = basePath === "/" ? "/_astro/" : `${basePath}/_astro/`;
  if (pathname.startsWith(assetPrefix)) {
    return next();
  }

  const sessionResult = await requireAdminSession({
    request,
    redirect: context.redirect
  });

  if (sessionResult instanceof Response) {
    return sessionResult;
  }

  context.locals.auth = buildAuthPayload(sessionResult);

  const pluginSlug = resolvePluginSlug(pathname, basePath);
  if (pluginSlug) {
    try {
      const response = await serverApiGet<{ plugin: { enabled: boolean; status: string } }>(
        request,
        `/plugins/${pluginSlug}`
      );
      const plugin = response.data?.plugin;
      if (!plugin?.enabled || plugin.status !== "enabled") {
        const target = basePath === "/" ? "/plugins" : `${basePath}/plugins`;
        return context.redirect(target);
      }
    } catch (error) {
      if (error instanceof ServerApiError && error.status === 404) {
        // Plugin manager API not available; allow request.
      } else {
        return context.redirect(basePath === "/" ? "/" : basePath);
      }
    }
  }

  return next();
};
