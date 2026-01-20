import type { Ctx } from "../../../../platform/ctx";
import { getOpenApiSpec } from "../../../../platform/openapi/spec";
import { createApiRevision } from "../../../../platform/openapi/revision";

export const SDK_CACHE_CONTROL = "public, max-age=0, must-revalidate";

export function getCachedOpenApi(ctx: Ctx) {
  return ctx.services.openApi ?? getOpenApiSpec();
}

export function getEffectiveOpenApi(ctx: Ctx) {
  if (ctx.services.pluginManagerState?.rebuildOpenApi) {
    return ctx.services.pluginManagerState.rebuildOpenApi();
  }
  return getCachedOpenApi(ctx);
}

export function getApiRevision(ctx: Ctx) {
  return createApiRevision(getCachedOpenApi(ctx));
}

export function isEtagMatch(ctx: Ctx, revision: string) {
  const ifNoneMatch = ctx.req.headers["if-none-match"];
  const etag = `"${revision}"`;
  if (!ifNoneMatch) return { match: false, etag };
  const tags = Array.isArray(ifNoneMatch) ? ifNoneMatch : [ifNoneMatch];
  return { match: tags.includes(etag), etag };
}
