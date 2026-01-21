import type { Ctx } from "../../../../platform/ctx";
import { getApiRevision } from "./_sdk";
import { okResponse } from "../../../../routes/_openapi";

export const config = {
  auth: "required",
  intent: "sdk.write",
  tags: ["sdk"],
  summary: "Invalidate SDK artifacts",
  openapi: {
    operation: {
      responses: {
        200: {
          description: "SDK cache invalidated",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: {
                  apiRevision: { type: "string" },
                  generatedAt: {
                    oneOf: [{ type: "string", format: "date-time" }, { type: "null" }]
                  }
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
  if (!sdkService?.invalidate) {
    return ctx.error(500, "sdk_unavailable", "SDK service unavailable");
  }

  await sdkService.invalidate();
  const apiRevision = getApiRevision(ctx);
  return ctx.json({
    apiRevision,
    generatedAt: null
  });
};
