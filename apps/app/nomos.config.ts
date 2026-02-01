import { defineConfig } from "./src/platform/config/nomos-config";

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig({
  app: {
    name: "Nomos App",
    env: process.env.NODE_ENV ?? "development"
  },
  logging: {
    level: process.env.LOG_LEVEL ?? "info",
    pretty: process.env.NODE_ENV !== "production"
  },
  observability: {
    // How often to emit obs.health (seconds). Set here (e.g. 600) or use env OBS_HEALTH_SIGNAL_INTERVAL_S. Default 30. Set 0 to disable.
    healthSignalIntervalS: (() => {
      const env = process.env.OBS_HEALTH_SIGNAL_INTERVAL_S;
      if (env != null && env !== "") {
        const n = Number(env);
        if (Number.isFinite(n) && n >= 0) return n;
      }
      return 30;
    })(),
  },
  modules: {
    auth: true,
    admin: true,
    docs: true,
    pluginManager: isProduction ? false : true
  }
});
