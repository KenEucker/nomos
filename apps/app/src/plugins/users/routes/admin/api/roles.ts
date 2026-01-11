import { z } from "zod";
import type { Ctx } from "../../../../../platform/ctx.js";

export const config = {
  auth: "required",
  permissions: ["roles.manage"],
  tags: ["admin"],
  summary: "Manage roles"
};

export const get = async (ctx: Ctx) => {
  const roles = Array.from(ctx.db.roles.entries()).map(([name, permissions]) => ({
    name,
    permissions
  }));
  return ctx.json({ roles });
};

export const postConfig = {
  auth: "required",
  permissions: ["roles.manage"],
  validate: {
    body: z.object({
      name: z.string(),
      permissions: z.array(z.string())
    })
  }
};

export const post = async (ctx: Ctx) => {
  ctx.db.roles.set(ctx.body.name, ctx.body.permissions);
  return ctx.json({ status: "created" }, 201);
};
