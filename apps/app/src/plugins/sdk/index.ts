import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSdkService } from "./services/sdk.service";

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
  nav: [{ path: "/sdk", label: "SDK" }]
};
