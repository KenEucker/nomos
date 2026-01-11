import { z } from "zod";
import type { Ctx } from "../../../../platform/ctx.js";

export const config = {
  auth: "required",
  permissions: ["auth.manage"],
  tags: ["admin"],
  summary: "Manage API keys"
};

export const get = async (ctx: Ctx) => {
  return ctx.json({ apiKeys: Array.from(ctx.db.apiKeys.values()) });
};

export const postConfig = {
  auth: "required",
  permissions: ["auth.manage"],
  validate: {
    body: z.object({
      name: z.string().optional(),
      permissions: z.array(z.string()).optional(),
      allowedHosts: z.array(z.string()).optional()
    }).partial()
  }
};

export const post = async (ctx: Ctx) => {
  const entry = ctx.services.auth.createApiKey(ctx.body ?? {});
  return ctx.json(entry, 201);
};
