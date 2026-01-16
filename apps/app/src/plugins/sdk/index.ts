import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSdkService } from "./services/sdk.service";
import { PreviewContext, PluginPlan } from "../../platform/pluginManager/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  slug: "sdk",
  name: "sdk",
  version: "1.0.0",
  description: "Runtime SDK generation and delivery for the Nomos OpenAPI surface.",
  permissions: ["sdk.read", "sdk.write"],
  routes: [{ baseDir: path.join(__dirname, "routes"), owner: "sdk" }],
  services: {
    sdk: () => createSdkService()
  },
  preview: (ctx: PreviewContext): PluginPlan => {
    ctx.declare.permission("sdk.read");
    ctx.declare.permission("sdk.write");

    ctx.declare.route({ method: "GET", path: "/sdk", description: "Show SDK panel" });

    ctx.declare.adminPage({
      path: "/sdk",
      title: "SDK",
      description: "Manage SDK settings."
    });
    ctx.declare.adminMenu({ label: "SDK", path: "/sdk" });
    return {
      slug: "sdk",
      version: "1.0.0",
      summary: "Adds SDK management routes, admin resources, and audit hooks.",
      warnings: ctx.env.nodeEnv === "production" ? [] : ["Demo data is enabled in development."]
    };
  },
  nav: [{ path: "/sdk", label: "SDK" }],
};
