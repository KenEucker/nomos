import type { ApiResponse } from "../api";

export class ServerApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
}

const buildHeaders = (request: Request, options: RequestInit) => {
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

export async function serverApiFetch<T>(request: Request, path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
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
