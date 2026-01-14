import { z } from "zod";
import type { Ctx } from "../../../../ctx";
import { parseSort } from "../../../validation";

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  sort: z.string().optional()
});

export const config = {
  auth: "required",
  roles: ["admin"],
  tags: ["admin"],
  summary: "List sessions",
  validate: { query: querySchema }
};

export const get = async (ctx: Ctx) => {
  const { page, pageSize, search, sort } = ctx.query;

  const where = search
    ? {
        user: {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } }
          ]
        }
      }
    : undefined;

  const sortConfig = parseSort(sort, ["createdAt", "expiresAt", "userName", "userEmail"]);
  let orderBy: any = { createdAt: "desc" };
  if (sortConfig) {
    if (sortConfig.field === "userName") {
      orderBy = { user: { name: sortConfig.order } };
    } else if (sortConfig.field === "userEmail") {
      orderBy = { user: { email: sortConfig.order } };
    } else {
      orderBy = { [sortConfig.field]: sortConfig.order };
    }
  }

  const [total, sessions] = await Promise.all([
    ctx.prisma.session.count({ where }),
    ctx.prisma.session.findMany({
      where,
      include: { user: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  const now = new Date();
  const serialized = sessions.map((session) => ({
    id: session.id,
    userId: session.userId,
    userName: session.user.name,
    userEmail: session.user.email,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    isExpired: session.expiresAt < now
  }));

  return ctx.json(
    { sessions: serialized },
    200,
    { page, pageSize, total }
  );
};
