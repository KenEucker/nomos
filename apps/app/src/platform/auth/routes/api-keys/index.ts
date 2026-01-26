import { z } from "zod";
import type { Ctx } from "../../../ctx";

export const config = {
  auth: "required",
  intent: "auth.manage",
  tags: ["admin"],
  summary: "Manage API keys"
};

export const postConfig = {
  auth: "required",
  intent: "auth.manage",
  validate: {
    body: z.object({
      name: z.string().optional(),
      permissions: z.array(z.string()).optional(),
      allowedHosts: z.array(z.string()).optional()
    }).partial()
  }
};

export const get = async (ctx: Ctx) => {
  return ctx.json({ apiKeys: Array.from(ctx.db.apiKeys.values()) });
};

export const post = async (ctx: Ctx) => {
  const entry = ctx.services.auth.createApiKey(ctx.body ?? {});
  return ctx.json(entry, 201);
};
