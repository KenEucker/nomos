import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createSdkService } from "../src/plugins/sdk/services/sdk.service";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const appDir = path.join(rootDir, "apps", "app");

const openApi = await loadOpenApiSpec(appDir);
const sdkService = createSdkService();

await sdkService.ensureArtifacts(openApi);

async function loadOpenApiSpec(baseDir: string) {
  if (process.env.OPENAPI_SPEC_URL) {
    const response = await fetch(process.env.OPENAPI_SPEC_URL);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch OpenAPI spec from ${process.env.OPENAPI_SPEC_URL}: ${response.status}`
      );
    }
    return response.json();
  }

  const specPath = resolveSpecPath(baseDir);
  try {
    const contents = await fs.readFile(specPath, "utf-8");
    return JSON.parse(contents);
  } catch (error) {
    const suffix = process.env.OPENAPI_SPEC_PATH
      ? "Check OPENAPI_SPEC_PATH."
      : "Set OPENAPI_SPEC_PATH or OPENAPI_SPEC_URL.";
    throw new Error(`Failed to read OpenAPI spec at ${specPath}. ${suffix}`, {
      cause: error
    });
  }
}

function resolveSpecPath(baseDir: string) {
  const candidate =
    process.env.OPENAPI_SPEC_PATH ?? path.join(baseDir, "openapi.json");
  const resolved = path.isAbsolute(candidate) ? candidate : path.join(baseDir, candidate);
  return resolved;
}
