import type { Ctx } from "../../../../platform/ctx";
import { defineRoute } from "../../../../platform/router/defineRoute";
import { adminUsersContract } from "../users.contract";

export default defineRoute(adminUsersContract, {
  operations: {
    get: {
      intent: adminUsersContract.intents.list,
      summary: "Admin users list",
      handler: async (ctx: Ctx) => {
        return ctx.json({ users: ctx.services.users.list() });
      },
    },
    post: {
      intent: adminUsersContract.intents.create,
      validate: { body: adminUsersContract.schema.createBody },
      summary: "Admin create user",
      handler: async (ctx: Ctx) => {
        const user = await ctx.services.users.create(ctx.body);
        return ctx.json(user, 201);
      },
    },
  },
});
