export const config = {
  auth: "required",
  permissions: ["admin.read"],
  tags: ["admin"],
  summary: "Audit log"
};

import type { Ctx } from "../../../../ctx";

export const get = async (ctx: Ctx) => {
  return ctx.json({ audit: ctx.db.auditLog.slice(-200) });
};
