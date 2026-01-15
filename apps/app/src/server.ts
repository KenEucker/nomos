import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createApp } from "./platform/createApp";
import { loadNomosConfig } from "./platform/config/nomos-config";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const appDir = path.join(rootDir, "apps", "app");
const cwdDir = process.cwd();
const envPaths = [
  path.join(cwdDir, ".env"),
  path.join(rootDir, ".env"),
  path.join(appDir, ".env")
];
for (const envPath of envPaths) {
  dotenv.config({ path: envPath, override: true });
}

const { config } = await loadNomosConfig({ rootDir: appDir });

const app = await createApp(config);

app.listen({ port: config.server.port, host: config.server.host }, (err, address) => {
  if (err) {
    app.log.error(err, "Failed to start server");
    process.exit(1);
  }
  app.log.info(`Server running at ${address}`);
});
