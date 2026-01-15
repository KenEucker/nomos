import { defineConfig } from "./src/platform/config/nomos-config";

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig({
  app: {
    name: "Nomos App",
    env: process.env.NODE_ENV ?? "development"
  },
  logging: {
    pretty: process.env.NODE_ENV !== "production"
  },
  modules: {
    auth: true,
    admin: true,
    docs: true,
    pluginManager: isProduction ? false : true
  }
});
