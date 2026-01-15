const env = process.env.NODE_ENV ?? "development";
const hasWeb = __HAS_WEB__;

export default {
  app: {
    name: "__APP_NAME__",
    env,
    hasWeb
  },
  server: {
    host: process.env.HOST ?? "0.0.0.0",
    port: Number(process.env.PORT ?? 3001),
    trustProxy: true
  },
  logging: {
    level: process.env.LOG_LEVEL ?? "info",
    pretty: env !== "production"
  },
  database: {
    __DB_DIALECT__
  },
  modules: {
    auth: __AUTH_ENABLED__,
    admin: true,
    docs: true,
    devtools: true,
    pluginManager: false
  }
};
