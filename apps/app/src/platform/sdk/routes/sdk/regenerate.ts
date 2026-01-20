import type { Ctx } from "../../../../platform/ctx";
import { getEffectiveOpenApi } from "./_sdk";
import { okResponse } from "../../../../routes/_openapi";

export const config = {
  auth: "required",
  permissions: ["sdk.write"],
  tags: ["sdk"],
  summary: "Regenerate SDK artifacts",
  openapi: {
    operation: {
      responses: {
        200: {
          description: "SDK regenerated",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: {
                  apiRevision: { type: "string" },
                  generatedAt: { type: "string", format: "date-time" }
                },
                required: ["apiRevision", "generatedAt"]
              })
            }
          }
        }
      }
    }
  }
};

export const post = async (ctx: Ctx) => {
  const sdkService = ctx.services.sdk;
  if (!sdkService?.regenerate) {
    return ctx.error(500, "sdk_unavailable", "SDK service unavailable");
  }

  const openApi = getEffectiveOpenApi(ctx);
  const artifacts = await sdkService.regenerate(openApi);

  return ctx.json({
    apiRevision: artifacts.revision,
    generatedAt: artifacts.generatedAt
  });
};
