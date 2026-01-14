import type { MiddlewareHandler } from "astro";
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

  return next();
};
