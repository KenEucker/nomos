import type { MiddlewareHandler } from "astro";
import path from "node:path";
import { requireAdminSession } from "./lib/server/session";

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

const sdkModulePromise = import(
  new URL("../../plugins/sdk/dist/client.js", import.meta.url).href
);

const resolveServerOrigin = (request: Request) => {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
  const host = forwardedHost ?? request.headers.get("host") ?? requestUrl.host;
  let origin = `${forwardedProto}://${host}`;

  const astroDevPort = Number(process.env.ASTRO_DEV_PORT ?? 4321);
  const appPort = process.env.PORT ?? "3001";
  if (host.endsWith(`:${astroDevPort}`)) {
    origin = `${forwardedProto}://localhost:${appPort}`;
  }

  return origin;
};

const buildHeaders = (request: Request) => {
  const headers: Record<string, string> = {};
  const cookie = request.headers.get("cookie");
  if (cookie) headers.cookie = cookie;
  const authorization = request.headers.get("authorization");
  if (authorization) headers.authorization = authorization;
  return headers;
};

const resolvePluginSlug = (pathname: string, basePath: string) => {
  const normalized = basePath === "/" ? pathname : pathname.replace(basePath, "") || "/";
  return pluginRouteMap.get(normalized);
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

  const pluginSlug = resolvePluginSlug(pathname, basePath);
  if (pluginSlug) {
    try {
      const sdkModule = await sdkModulePromise;
      const client = sdkModule.createNomosClient({
        baseUrl: resolveServerOrigin(request),
        headers: buildHeaders(request)
      });
      const response = await client.GET(`/plugins/${pluginSlug}`);
      const plugin = response.data?.plugin;
      if (!plugin?.enabled || plugin.status !== "enabled") {
        const target = basePath === "/" ? "/plugins" : `${basePath}/plugins`;
        return context.redirect(target);
      }
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 404) {
        // Plugin manager API not available; allow request.
      } else {
        return context.redirect(basePath === "/" ? "/" : basePath);
      }
    }
  }

  return next();
};
