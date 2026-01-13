import { z } from "zod";
import type { Ctx } from "../../../../ctx";
import { HttpError } from "../../../../errors";

const paramsSchema = z.object({ id: z.string() });

export const config = {
  auth: "required",
  roles: ["admin"],
  tags: ["admin"],
  summary: "Get session",
  validate: { params: paramsSchema }
};

export const get = async (ctx: Ctx) => {
  const session = await ctx.prisma.session.findUnique({
    where: { id: ctx.params.id },
    include: { user: true }
  });

  if (!session) {
    throw new HttpError(404, "not_found", "Session not found");
  }

  const now = new Date();
  return ctx.json({
    session: {
      id: session.id,
      userId: session.userId,
      userName: session.user.name,
      userEmail: session.user.email,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      isExpired: session.expiresAt < now
    }
  });
};

export const delConfig = {
  auth: "required",
  roles: ["admin"],
  validate: { params: paramsSchema }
};

export const del = async (ctx: Ctx) => {
  const session = await ctx.prisma.session.findUnique({
    where: { id: ctx.params.id }
  });

  if (!session) {
    throw new HttpError(404, "not_found", "Session not found");
  }

  await ctx.prisma.session.delete({ where: { id: ctx.params.id } });
  return ctx.json({ deleted: true });
};
