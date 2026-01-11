import { createApp } from "./platform/createApp.js";
import { loadEnv } from "./platform/config/env.js";

const env = loadEnv();

const app = await createApp();

app.listen({ port: env.PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err, "Failed to start server");
    process.exit(1);
  }
  app.log.info(`Server running at ${address}`);
});
