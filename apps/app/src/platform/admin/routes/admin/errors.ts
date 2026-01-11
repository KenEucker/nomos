export const config = {
  auth: "required",
  permissions: ["admin.read"],
  tags: ["admin"],
  summary: "Recent errors"
};

import type { Ctx } from "../../../ctx.js";

export const get = async (ctx: Ctx) => {
  return ctx.json({ errors: ctx.db.errors.slice(-200) });
};
