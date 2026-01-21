import type { Ctx } from "../../platform/ctx";
import { HttpError } from "../../platform/errors";
import { defineRoute } from "../../platform/router/defineRoute";
import { rolesContract } from "./roles.contract";

export default defineRoute(rolesContract, {
  operations: {
    get: {
      intent: rolesContract.intents.read,
      validate: { params: rolesContract.schema.paramsId },
      summary: "Get role",
      handler: async (ctx: Ctx) => {
        const role = await ctx.prisma.role.findUnique({
          where: { id: ctx.params.id },
          include: { users: true },
        });

        if (!role) {
          throw new HttpError(404, "not_found", "Role not found", { resource: "Role" });
        }

        return ctx.json({
          role: {
            id: role.id,
            key: role.key,
            name: role.name,
            userCount: role.users.length,
          },
        });
      },
    },
    patch: {
      intent: rolesContract.intents.update,
      validate: {
        params: rolesContract.schema.paramsId,
        body: rolesContract.schema.updateBody,
      },
      summary: "Update role",
      handler: async (ctx: Ctx) => {
        const { name } = ctx.body;

        const existing = await ctx.prisma.role.findUnique({
          where: { id: ctx.params.id },
        });

        if (!existing) {
          throw new HttpError(404, "not_found", "Role not found", { resource: "Role" });
        }

        const updated = await ctx.prisma.role.update({
          where: { id: ctx.params.id },
          data: {
            ...(name ? { name } : {}),
          },
        });

        return ctx.json({ role: updated });
      },
    },
    delete: {
      intent: rolesContract.intents.delete,
      validate: { params: rolesContract.schema.paramsId },
      summary: "Delete role",
      handler: async (ctx: Ctx) => {
        const existing = await ctx.prisma.role.findUnique({
          where: { id: ctx.params.id },
          include: { users: true },
        });

        if (!existing) {
          throw new HttpError(404, "not_found", "Role not found", { resource: "Role" });
        }

        if (existing.users.length > 0) {
          throw new HttpError(
            400,
            "role_in_use",
            `Cannot delete role: ${existing.users.length} user(s) still have this role`
          );
        }

        await ctx.prisma.role.delete({ where: { id: ctx.params.id } });
        return ctx.json({ deleted: true });
      },
    },
  },
});
