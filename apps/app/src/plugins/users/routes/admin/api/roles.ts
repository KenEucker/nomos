import type { Ctx } from "../../../../../platform/ctx";
import { defineRoute } from "../../../../../platform/router/defineRoute";
import { adminRolesContract } from "../../users.contract";

export default defineRoute(adminRolesContract, {
  operations: {
    get: {
      intent: adminRolesContract.intents.list,
      summary: "List roles",
      handler: async (ctx: Ctx) => {
        const roles = Array.from(ctx.db.roles.entries()).map(
          ([name, permissions]: [string, string[]]) => ({ name, permissions })
        );
        return ctx.json({ roles });
      },
    },
    post: {
      intent: adminRolesContract.intents.create,
      validate: { body: adminRolesContract.schema.createBody },
      summary: "Create role",
      handler: async (ctx: Ctx) => {
        ctx.db.roles.set(ctx.body.name, ctx.body.permissions);
        return ctx.json({ status: "created" }, 201);
      },
    },
  },
});
