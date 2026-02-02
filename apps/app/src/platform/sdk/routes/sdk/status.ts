import type { Ctx } from "../../../../platform/ctx";
import { getEffectiveOpenApi } from "./_sdk";
import { okResponse } from "../../../../routes/_openapi";

export const config = {
  auth: "required",
  intent: "sdk.read",
  tags: ["sdk"],
  summary: "SDK generation status",
  openapi: {
    operation: {
      responses: {
        200: {
          description: "SDK status",
          content: {
            "application/json": {
              schema: okResponse(
                {
                  type: "object",
                  properties: {
                    sdk: {
                      type: "array",
                      items: { $ref: "#/components/schemas/SdkStatus" }
                    }
                  },
                  required: ["sdk"]
                },
                true
              )
            }
          }
        }
      }
    },
    components: {
      schemas: {
        SdkStatus: {
          type: "object",
          properties: {
            id: { type: "string" },
            apiRevision: { type: "string" },
            apiVersion: { type: "string" },
            platformVersion: { type: "string" },
            generatedAt: { type: "string", format: "date-time" },
            artifacts: {
              type: "object",
              properties: {
                js: { type: "string" },
                ts: { type: "string" },
                dts: { type: "string" }
              },
              required: ["js", "ts", "dts"]
            }
          },
          required: ["id", "apiRevision", "apiVersion", "platformVersion", "generatedAt", "artifacts"]
        }
      }
    }
  }
};

export const get = async (ctx: Ctx) => {
  const sdkService = ctx.services.sdk;
  if (!sdkService?.getStatus) {
    return ctx.error(500, "sdk_unavailable", "SDK service unavailable");
  }

  const openApi = getEffectiveOpenApi(ctx);
  const apiVersion = openApi.info?.version ?? "unknown";
  const platformVersion = "0.1.3";
  const status = await sdkService.getStatus(openApi);

  const payload = {
    sdk: [
      {
        id: "runtime",
        apiRevision: status.apiRevision,
        apiVersion,
        platformVersion,
        generatedAt: status.generatedAt,
        artifacts: status.artifacts
      }
    ]
  };

  return ctx.json(payload, 200, { total: 1, page: 1, pageSize: 1 });
};
