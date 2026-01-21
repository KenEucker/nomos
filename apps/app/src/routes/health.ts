import type { Ctx } from "../platform/ctx";
import { defineRoute } from "../platform/router/defineRoute";
import { systemContract } from "./system.contract";

export default defineRoute(systemContract, {
  auth: "none",
  handlers: {
    get: async (ctx: Ctx) => {
      return ctx.json({ status: "ok" });
    },
  },
});
