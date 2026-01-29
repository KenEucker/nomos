import { createSdkService } from "./services/sdk.service";

export default {
  slug: "sdk",
  name: "sdk",
  version: "1.0.0",
  description: "Runtime SDK generation and delivery for the Nomos OpenAPI surface.",
  menuGroup: "System",
  intents: ["sdk.read", "sdk.write"],
  adminPages: [{ path: "/sdk", label: "SDK" }],
  services: {
    sdk: () => createSdkService()
  },
};
