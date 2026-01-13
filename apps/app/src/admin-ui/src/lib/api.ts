export type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  meta?: { page: number; pageSize: number; total: number };
  error?: { code: string; message: string; details?: any };
};

export async function apiFetch<T>(path: string, options: RequestInit = {}) {
  // Only set content-type for requests with a body
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> ?? {}) };
  if (options.body) {
    headers["content-type"] = "application/json";
  }

  const res = await fetch(path, {
    credentials: "include",
    headers,
    ...options
  });
  const data = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !data.ok) {
    const message = data.error?.message ?? "Request failed";
    const error = new Error(message);
    (error as any).code = data.error?.code;
    (error as any).details = data.error?.details;
    throw error;
  }
  return data;
}

export async function apiGet<T>(path: string) {
  return apiFetch<T>(path, { method: "GET" });
}

export async function apiPost<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined
  });
}

export async function apiPatch<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined
  });
}

export async function apiPut<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined
  });
}

export async function apiDelete<T>(path: string) {
  return apiFetch<T>(path, { method: "DELETE" });
}
