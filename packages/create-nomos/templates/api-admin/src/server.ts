import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createApp, loadNomosConfig } from "nomos-core";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(rootDir, ".env");

dotenv.config({ path: envPath, override: true });

const { config } = await loadNomosConfig({ rootDir });
const app = await createApp(config);

app.listen({ port: config.server.port, host: config.server.host }, (err, address) => {
  if (err) {
    app.log.error(err, "Failed to start server");
    process.exit(1);
  }
  app.log.info(`Server running at ${address}`);
});
