export const config = {
  auth: "none",
  tags: ["system"],
  summary: "Version info"
};

import type { Ctx } from "nomos-core";

export const get = async (ctx: Ctx) => {
  return ctx.json({
    name: process.env.APP_NAME ?? "Nomos App",
    version: process.env.APP_VERSION ?? "0.1.0",
    build: process.env.BUILD_SHA ?? "dev"
  });
};
