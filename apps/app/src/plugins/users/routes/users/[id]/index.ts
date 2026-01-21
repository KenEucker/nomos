import bcrypt from "bcryptjs";
import type { Ctx } from "../../../../../platform/ctx";
import { HttpError } from "../../../../../platform/errors";
import { serializeUser } from "../../../../../routes/_serializers";
import { defineRoute } from "../../../../../platform/router/defineRoute";
import { usersContract } from "../../users.contract";

export default defineRoute(usersContract, {
  operations: {
    get: {
      intent: usersContract.intents.read,
      validate: { params: usersContract.schema.paramsId },
      summary: "Get user",
      handler: async (ctx: Ctx) => {
        const user = await ctx.prisma.user.findUnique({
          where: { id: ctx.params.id },
          include: { roles: { include: { role: true } } },
        });

        if (!user) {
          throw new HttpError(404, "not_found", "User not found", { resource: "User" });
        }

        return ctx.json({ user: serializeUser(user) });
      },
    },
    patch: {
      intent: usersContract.intents.update,
      validate: {
        params: usersContract.schema.paramsId,
        body: usersContract.schema.updateBody,
      },
      summary: "Update user",
      handler: async (ctx: Ctx) => {
        const { name, email, password, roles } = ctx.body;

        const existing = await ctx.prisma.user.findUnique({
          where: { id: ctx.params.id },
        });

        if (!existing) {
          throw new HttpError(404, "not_found", "User not found", { resource: "User" });
        }

        const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;

        const updated = await ctx.prisma.user.update({
          where: { id: ctx.params.id },
          data: {
            ...(name ? { name } : {}),
            ...(email ? { email } : {}),
            ...(passwordHash ? { passwordHash } : {}),
          },
          include: { roles: { include: { role: true } } },
        });

        // Update roles if provided
        if (roles !== undefined) {
          await ctx.prisma.userRole.deleteMany({
            where: { userId: ctx.params.id },
          });

          if (roles.length > 0) {
            const roleRecords = await ctx.prisma.role.findMany({
              where: { key: { in: roles } },
            });
            await ctx.prisma.userRole.createMany({
              data: roleRecords.map((role) => ({
                userId: ctx.params.id,
                roleId: role.id,
              })),
            });
          }

          const refreshed = await ctx.prisma.user.findUnique({
            where: { id: ctx.params.id },
            include: { roles: { include: { role: true } } },
          });
          return ctx.json({ user: serializeUser(refreshed!) });
        }

        return ctx.json({ user: serializeUser(updated) });
      },
    },
    delete: {
      intent: usersContract.intents.delete,
      validate: { params: usersContract.schema.paramsId },
      summary: "Delete user",
      handler: async (ctx: Ctx) => {
        const existing = await ctx.prisma.user.findUnique({
          where: { id: ctx.params.id },
        });

        if (!existing) {
          throw new HttpError(404, "not_found", "User not found", { resource: "User" });
        }

        await ctx.prisma.user.delete({ where: { id: ctx.params.id } });
        return ctx.json({ deleted: true });
      },
    },
  },
});
