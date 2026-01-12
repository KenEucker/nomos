export const config = {
  auth: "none",
  tags: ["system"],
  summary: "Version info"
};

import type { Ctx } from "../platform/ctx.js";

export const get = async (ctx: Ctx) => {
  return ctx.json({
    name: "nomos-platform",
    version: "0.1.0",
    build: process.env.BUILD_SHA ?? "dev"
  });
};
