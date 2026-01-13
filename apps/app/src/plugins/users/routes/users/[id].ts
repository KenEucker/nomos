import { z } from "zod";
import type { Ctx } from "../../../../../platform/ctx";

export const config = {
  auth: "required",
  permissions: ["users.read"],
  tags: ["users"],
  summary: "User detail"
};

export const get = async (ctx: Ctx) => {
  const user = ctx.services.users.get(ctx.params.id);
  if (!user) return ctx.error(404, "not_found", "Not found");
  return ctx.json(user);
};

export const patchConfig = {
  auth: "required",
  permissions: ["users.update"],
  validate: {
    body: z.object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      roles: z.array(z.string()).optional()
    })
  }
};

export const patch = async (ctx: Ctx) => {
  const user = await ctx.services.users.update(ctx.params.id, ctx.body);
  if (!user) return ctx.error(404, "not_found", "Not found");
  return ctx.json(user);
};

export const delConfig = {
  auth: "required",
  permissions: ["users.delete"],
  summary: "Delete user"
};

export const del = async (ctx: Ctx) => {
  const user = await ctx.services.users.remove(ctx.params.id);
  if (!user) return ctx.error(404, "not_found", "Not found");
  return ctx.json({ status: "deleted" });
};
