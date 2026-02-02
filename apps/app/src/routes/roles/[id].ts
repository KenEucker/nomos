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
          include: {
            users: true,
            permissions: { include: { permission: true } },
          },
        });

        if (!role) {
          throw new HttpError(404, "not_found", "Role not found", { resource: "Role" });
        }

        const permissionKeys = role.permissions.map((rp) => rp.permission.key);
        return ctx.json({
          role: {
            id: role.id,
            key: role.key,
            name: role.name,
            userCount: role.users.length,
            permissionKeys,
            permissions: permissionKeys,
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
        const { name, permissions: permissionKeys } = ctx.body;
        const roleId = ctx.params.id;

        const existing = await ctx.prisma.role.findUnique({
          where: { id: roleId },
          include: { permissions: { include: { permission: true } } },
        });

        if (!existing) {
          throw new HttpError(404, "not_found", "Role not found", { resource: "Role" });
        }

        await ctx.prisma.role.update({
          where: { id: roleId },
          data: {
            ...(name ? { name } : {}),
          },
        });

        if (permissionKeys !== undefined) {
          await ctx.prisma.$transaction(async (tx) => {
            await tx.rolePermission.deleteMany({
              where: { roleId },
            });
            if (permissionKeys.length > 0) {
              const permissions = await tx.permission.findMany({
                where: { key: { in: permissionKeys } },
              });
              await tx.rolePermission.createMany({
                data: permissions.map((p) => ({
                  roleId,
                  permissionId: p.id,
                })),
              });
            }
          });
        }

        const updated = await ctx.prisma.role.findUnique({
          where: { id: roleId },
          include: { permissions: { include: { permission: true } } },
        });
        const keys = updated
          ? updated.permissions.map((rp) => rp.permission.key)
          : existing.permissions.map((rp) => rp.permission.key);
        const role = updated
          ? {
              id: updated.id,
              key: updated.key,
              name: updated.name,
              permissionKeys: keys,
              permissions: keys,
            }
          : {
              id: existing.id,
              key: existing.key,
              name: existing.name,
              permissionKeys: keys,
              permissions: keys,
            };
        return ctx.json({ role });
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
