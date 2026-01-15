export const config = {
  auth: "required",
  permissions: ["admin.read"],
  tags: ["admin"],
  summary: "Clear audit log"
};

import type { Ctx } from "../../../../ctx";

export const post = async (ctx: Ctx) => {
  ctx.db.auditLog = [];
  return ctx.json({ cleared: true });
};
