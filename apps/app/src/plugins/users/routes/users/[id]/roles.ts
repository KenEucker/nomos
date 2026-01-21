import type { Ctx } from "../../../../../platform/ctx";
import { HttpError } from "../../../../../platform/errors";
import { serializeUser } from "../../../../../routes/_serializers";
import { defineRoute } from "../../../../../platform/router/defineRoute";
import { usersContract } from "../../users.contract";

export default defineRoute(usersContract, {
  operations: {
    put: {
      intent: "roles.manage",
      validate: {
        params: usersContract.schema.paramsId,
        body: usersContract.schema.rolesBody,
      },
      summary: "Replace user roles",
      handler: async (ctx: Ctx) => {
        const user = await ctx.prisma.user.findUnique({
          where: { id: ctx.params.id },
        });

        if (!user) {
          throw new HttpError(404, "not_found", "User not found", { resource: "User" });
        }

        const roleRecords = await ctx.prisma.role.findMany({
          where: { key: { in: ctx.body.roles } },
        });

        await ctx.prisma.userRole.deleteMany({ where: { userId: user.id } });
        await ctx.prisma.userRole.createMany({
          data: roleRecords.map((role) => ({ userId: user.id, roleId: role.id })),
        });

        const updated = await ctx.prisma.user.findUnique({
          where: { id: user.id },
          include: { roles: { include: { role: true } } },
        });

        if (!updated) {
          throw new HttpError(404, "not_found", "User not found", { resource: "User" });
        }

        return ctx.json({ user: serializeUser(updated) });
      },
    },
  },
});
