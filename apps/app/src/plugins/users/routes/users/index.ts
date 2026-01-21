import bcrypt from "bcryptjs";
import type { Ctx } from "../../../../platform/ctx";
import { HttpError } from "../../../../platform/errors";
import { parseSort } from "../../../../platform/validation";
import { serializeUser } from "../../../../routes/_serializers";
import { defineRoute } from "../../../../platform/router/defineRoute";
import { usersContract } from "../users.contract";

export default defineRoute(usersContract, {
  operations: {
    get: {
      intent: usersContract.intents.list,
      validate: { query: usersContract.schema.queryList },
      summary: "List users",
      handler: async (ctx: Ctx) => {
        const { page, pageSize, search, sort } = ctx.query;
        const where = search
          ? {
              OR: [
                { email: { contains: search } },
                { name: { contains: search } },
              ],
            }
          : undefined;

        const sortConfig = parseSort(sort, ["createdAt", "email", "name"]);
        const [total, users] = await Promise.all([
          ctx.prisma.user.count({ where }),
          ctx.prisma.user.findMany({
            where,
            include: { roles: { include: { role: true } } },
            orderBy: sortConfig ? { [sortConfig.field]: sortConfig.order } : { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
        ]);

        return ctx.json({ users: users.map(serializeUser) }, 200, {
          pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
      },
    },
    post: {
      intent: usersContract.intents.create,
      validate: { body: usersContract.schema.createBody },
      summary: "Create user",
      handler: async (ctx: Ctx) => {
        const { email, name, password, roles } = ctx.body;

        const existing = await ctx.prisma.user.findUnique({ where: { email } });
        if (existing) {
          throw new HttpError(409, "conflict", "Email already exists");
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const created = await ctx.prisma.user.create({
          data: {
            email,
            name,
            passwordHash,
            roles: roles?.length
              ? {
                  create: roles.map((roleKey: string) => ({
                    role: { connect: { key: roleKey } },
                  })),
                }
              : undefined,
          },
          include: { roles: { include: { role: true } } },
        });

        return ctx.json({ user: serializeUser(created) }, 201);
      },
    },
  },
});
