import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/platform/createApp";
import { loadNomosConfig } from "../src/platform/config/nomos-config";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const appDir = path.join(rootDir, "apps", "app");

const { config } = await loadNomosConfig({ rootDir: appDir });

const app = await createApp(config);

try {
  const services = (app as any).services as Record<string, any> | undefined;
  if (!services?.openApi) {
    throw new Error("OpenAPI spec is missing; cannot generate SDK artifacts.");
  }
  if (!services.sdk?.ensureArtifacts) {
    throw new Error("SDK service is missing; cannot generate SDK artifacts.");
  }

  await services.sdk.ensureArtifacts(services.openApi);
} finally {
  await app.close();
}
