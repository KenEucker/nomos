export const config = {
  auth: "required",
  permissions: ["admin.read"],
  tags: ["admin"],
  summary: "Audit log"
};

import type { Ctx } from "../../../../ctx.js";

export const get = async (ctx: Ctx) => {
  return ctx.json({ audit: ctx.db.auditLog.slice(-200) });
};
