import type { Ctx } from "../../platform/ctx";
import { HttpError } from "../../platform/errors";
import { parseSort } from "../../platform/validation";
import { defineRoute } from "../../platform/router/defineRoute";
import { rolesContract } from "./roles.contract";

export default defineRoute(rolesContract, {
  operations: {
    get: {
      intent: rolesContract.intents.list,
      validate: { query: rolesContract.schema.queryList },
      summary: "List roles",
      handler: async (ctx: Ctx) => {
        const { page, pageSize, search, sort } = ctx.query;
        const where = search
          ? {
              OR: [
                { key: { contains: search } },
                { name: { contains: search } },
              ],
            }
          : undefined;

        const sortConfig = parseSort(sort, ["key", "name"]);
        const [total, roles] = await Promise.all([
          ctx.prisma.role.count({ where }),
          ctx.prisma.role.findMany({
            where,
            include: {
              users: true,
              permissions: { include: { permission: true } },
            },
            orderBy: sortConfig ? { [sortConfig.field]: sortConfig.order } : { key: "asc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
        ]);

        const rolesWithCount = roles.map((role) => {
          const permissionKeys = role.permissions.map((rp) => rp.permission.key);
          return {
            id: role.id,
            key: role.key,
            name: role.name,
            userCount: role.users.length,
            permissionKeys,
            permissionCount: permissionKeys.length,
          };
        });

        return ctx.json({ roles: rolesWithCount }, 200, {
          pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
      },
    },
    post: {
      intent: rolesContract.intents.create,
      validate: { body: rolesContract.schema.createBody },
      summary: "Create role",
      handler: async (ctx: Ctx) => {
        const { key, name, permissions: permissionKeys } = ctx.body;

        const existing = await ctx.prisma.role.findUnique({ where: { key } });
        if (existing) {
          throw new HttpError(409, "conflict", "Role key already exists");
        }

        const created = await ctx.prisma.role.create({
          data: { key, name },
        });

        if (permissionKeys?.length) {
          const permissions = await ctx.prisma.permission.findMany({
            where: { key: { in: permissionKeys } },
          });
          await ctx.prisma.rolePermission.createMany({
            data: permissions.map((p) => ({
              roleId: created.id,
              permissionId: p.id,
            })),
          });
        }

        const roleWithPermissions = await ctx.prisma.role.findUnique({
          where: { id: created.id },
          include: { permissions: { include: { permission: true } } },
        });
        const keys = roleWithPermissions
          ? roleWithPermissions.permissions.map((rp) => rp.permission.key)
          : [];
        const role = roleWithPermissions
          ? {
              id: roleWithPermissions.id,
              key: roleWithPermissions.key,
              name: roleWithPermissions.name,
              permissionKeys: keys,
              permissions: keys,
            }
          : { id: created.id, key: created.key, name: created.name, permissionKeys: keys, permissions: keys };

        return ctx.json({ role }, 201);
      },
    },
  },
});
