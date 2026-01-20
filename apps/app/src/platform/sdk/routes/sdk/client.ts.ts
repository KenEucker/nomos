import fs from "node:fs/promises";
import type { Ctx } from "../../../../platform/ctx";
import { SDK_CACHE_CONTROL, getEffectiveOpenApi, isEtagMatch } from "./_sdk";

export const config = {
  auth: "none",
  tags: ["sdk"],
  summary: "Nomos SDK runtime client (TypeScript source)"
};

export const get = async (ctx: Ctx) => {
  const sdkService = ctx.services.sdk;
  if (!sdkService?.ensureArtifacts) {
    return ctx.error(500, "sdk_unavailable", "SDK service unavailable");
  }
  const openApi = getEffectiveOpenApi(ctx);
  const artifacts = await sdkService.ensureArtifacts(openApi);
  const { match, etag } = isEtagMatch(ctx, artifacts.revision);

  ctx.reply.header("ETag", etag);
  ctx.reply.header("Cache-Control", SDK_CACHE_CONTROL);

  if (match) {
    ctx.reply.code(304).send();
    return;
  }

  const payload = await fs.readFile(artifacts.files.ts, "utf-8");
  ctx.reply.type("application/typescript; charset=utf-8").send(payload);
};
