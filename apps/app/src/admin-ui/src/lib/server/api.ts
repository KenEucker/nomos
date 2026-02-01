import type { ApiResponse } from "../api";

export class ServerApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
}

export const buildHeaders = (request: Request, options: RequestInit) => {
  const headers = new Headers(options.headers ?? {});
  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("authorization", authorization);

  return headers;
};

export const resolveServerUrl = (request: Request, path: string) => {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

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

  return new URL(path, origin).toString();
};

export async function serverApiFetch<T>(request: Request, path: string, options: RequestInit = {}) {
  const res = await fetch(resolveServerUrl(request, path), {
    ...options,
    headers: buildHeaders(request, options)
  });

  let data: ApiResponse<T> | undefined;
  try {
    data = (await res.json()) as ApiResponse<T>;
  } catch {
    // ignore parse errors
  }

  if (res.status === 401) {
    const error = new ServerApiError("Unauthorized");
    error.status = 401;
    throw error;
  }

  if (!res.ok || !data?.ok) {
    const message = data?.error?.message ?? "Request failed";
    const error = new ServerApiError(message);
    error.status = res.status;
    error.code = data?.error?.code;
    error.details = data?.error?.details;
    throw error;
  }

  return data;
}

export async function serverApiGet<T>(request: Request, path: string) {
  return serverApiFetch<T>(request, path, { method: "GET" });
}

/**
 * Fetch a URL and only check res.ok (no ApiResponse shape required).
 * Use for endpoints that return raw JSON (e.g. /openapi.json).
 */
export async function serverFetchOk(
  request: Request,
  path: string,
  options: RequestInit = {}
): Promise<{ ok: true }> {
  const res = await fetch(resolveServerUrl(request, path), {
    ...options,
    method: options.method ?? "GET",
    headers: buildHeaders(request, options),
  });
  if (!res.ok) {
    const err = new ServerApiError(res.status === 403 ? "Forbidden" : "Request failed");
    err.status = res.status;
    throw err;
  }
  return { ok: true as const };
}
