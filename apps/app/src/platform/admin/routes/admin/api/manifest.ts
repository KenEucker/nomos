import { buildManifest } from "../../../manifest.js";
import type { Ctx } from "../../../../ctx.js";

export const config = {
  auth: "required",
  permissions: ["admin.read"],
  tags: ["admin"],
  summary: "Admin manifest"
};

export const get = async (ctx: Ctx) => {
  return ctx.json(buildManifest(ctx.services.pluginRegistry));
};
