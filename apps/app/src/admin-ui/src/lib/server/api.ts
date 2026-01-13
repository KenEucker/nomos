import type { APIContext } from "astro";
import type { ApiResponse } from "../api";

type ServerContext = Pick<APIContext, "request" | "url" | "redirect">;

export async function serverApiFetch<T>(
  context: ServerContext,
  path: string,
  options: RequestInit = {}
) {
  const headers = new Headers(options.headers ?? {});
  const cookie = context.request.headers.get("cookie");
  if (cookie) {
    headers.set("cookie", cookie);
  }
  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const url = new URL(path, context.url);
  const res = await fetch(url, {
    ...options,
    headers
  });

  if (res.status === 401) {
    throw context.redirect("/admin/login");
  }

  if (res.status === 403) {
    const error = new Error("forbidden");
    (error as { status?: number }).status = 403;
    throw error;
  }

  const data = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !data.ok) {
    const message = data.error?.message ?? "Request failed";
    const error = new Error(message);
    (error as { code?: string }).code = data.error?.code;
    (error as { details?: unknown }).details = data.error?.details;
    (error as { status?: number }).status = res.status;
    throw error;
  }

  return data;
}

export async function serverApiGet<T>(context: ServerContext, path: string) {
  return serverApiFetch<T>(context, path, { method: "GET" });
}
