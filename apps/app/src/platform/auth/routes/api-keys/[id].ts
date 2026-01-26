import { z } from "zod";
import type { Ctx } from "../../../ctx";

export const config = {
  auth: "required",
  intent: "auth.manage",
  tags: ["admin"],
  summary: "Update API key",
  validate: {
    params: z.object({
      id: z.string()
    }),
    body: z.object({
      action: z.enum(["rotate", "revoke"]).optional()
    })
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
  return ctx.error(400, "invalid_request", "Invalid action");
};
