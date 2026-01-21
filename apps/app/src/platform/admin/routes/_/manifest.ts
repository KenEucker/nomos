import { buildManifest } from "../../manifest";
import type { Ctx } from "../../../ctx";

export const config = {
  auth: "required",
  intent: "admin.read",
  tags: ["admin"],
  summary: "Admin manifest"
};

export const get = async (ctx: Ctx) => {
  return ctx.json(buildManifest(ctx.services.pluginRegistry));
};
