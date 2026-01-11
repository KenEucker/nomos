import { z } from "zod";
import type { Ctx } from "../../../../ctx.js";

export const config = {
  auth: "required",
  permissions: ["auth.manage"],
  tags: ["admin"],
  summary: "Update API key",
  validate: {
    body: z
      .object({
        action: z.enum(["rotate", "revoke"]).optional()
      })
      .partial()
  }
};

export const patch = async (ctx: Ctx) => {
  const { id } = ctx.params;
  const action = ctx.body?.action;
  if (action === "rotate") {
    const entry = ctx.services.auth.rotateApiKey(id);
    return ctx.json(entry ?? { error: "not_found" }, entry ? 200 : 404);
  }
  if (action === "revoke") {
    const entry = ctx.services.auth.revokeApiKey(id);
    return ctx.json(entry ?? { error: "not_found" }, entry ? 200 : 404);
  }
  return ctx.error(400, "Invalid action");
};
