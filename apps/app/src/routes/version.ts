import type { Ctx } from "../platform/ctx";
import { defineRoute } from "../platform/router/defineRoute";
import { systemContract } from "./system.contract";
import { getOpenApiSpec } from "../platform/openapi/spec";
import { createApiRevision } from "../platform/openapi/revision";

export default defineRoute(systemContract, {
  auth: "none",
  handlers: {
    get: async (ctx: Ctx) => {
      const openApi = getOpenApiSpec();
      const apiVersion = openApi.info?.version ?? "unknown";
      const apiRevision = createApiRevision(openApi);
      const platformVersion = "0.1.0";
      return ctx.json({
        name: "nomos-platform",
        version: platformVersion,
        platformVersion,
        apiVersion,
        apiRevision,
        build: process.env.BUILD_SHA ?? "dev",
      });
    },
  },
});
