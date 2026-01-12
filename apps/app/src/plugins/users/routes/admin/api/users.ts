import { z } from "zod";
import type { Ctx } from "../../../../../platform/ctx";

export const config = {
  auth: "required",
  permissions: ["users.read"],
  tags: ["admin"],
  summary: "Admin users"
};

export const get = async (ctx: Ctx) => {
  return ctx.json({ users: ctx.services.users.list() });
};

export const postConfig = {
  auth: "required",
  permissions: ["users.create"],
  validate: {
    body: z.object({
      name: z.string(),
      email: z.string().email(),
      roles: z.array(z.string()).optional()
    })
  }
};

export const post = async (ctx: Ctx) => {
  const user = await ctx.services.users.create(ctx.body);
  return ctx.json(user, 201);
};
