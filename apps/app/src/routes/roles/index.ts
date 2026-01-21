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
            include: { users: true },
            orderBy: sortConfig ? { [sortConfig.field]: sortConfig.order } : { key: "asc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
        ]);

        const rolesWithCount = roles.map((role) => ({
          id: role.id,
          key: role.key,
          name: role.name,
          userCount: role.users.length,
        }));

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
        const { key, name } = ctx.body;

        const existing = await ctx.prisma.role.findUnique({ where: { key } });
        if (existing) {
          throw new HttpError(409, "conflict", "Role key already exists");
        }

        const created = await ctx.prisma.role.create({
          data: { key, name },
        });

        return ctx.json({ role: created }, 201);
      },
    },
  },
});
