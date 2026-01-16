import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSdkService } from "./services/sdk.service";
import { PreviewContext, PluginPlan } from "../pluginManager/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  slug: "sdk",
  name: "sdk",
  version: "1.0.0",
  description: "Runtime SDK generation and delivery for the Nomos OpenAPI surface.",
  menuGroup: "System",
  permissions: ["sdk.read", "sdk.write"],
  routes: [{ baseDir: path.join(__dirname, "routes"), owner: "sdk" }],
  adminPages: [{ path: "/sdk", label: "SDK" }],
  services: {
    sdk: () => createSdkService()
  },
};
