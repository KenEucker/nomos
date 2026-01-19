import type { PanelCtx } from "./types"
import { apiFetch } from "./api"
import { serverApiFetch } from "./server/api"

export async function panelApiFetch<T>(
  ctx: PanelCtx,
  path: string,
  options: RequestInit = {}
) {
  if (typeof window !== "undefined") {
    return apiFetch<T>(path, options)
  }

  if (!ctx.request) {
    throw new Error("Missing request context for server API fetch")
  }

  return serverApiFetch<T>(ctx.request, path, options)
}
