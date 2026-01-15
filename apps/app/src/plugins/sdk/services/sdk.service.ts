import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSdkArtifactsStore } from "../lib/sdkArtifacts";
import { createApiRevision } from "../../../platform/openapi/revision";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");

export function createSdkService() {
  const store = createSdkArtifactsStore(distDir);

  const ensureArtifacts = async (spec: unknown, options?: { force?: boolean }) =>
    store.ensure(spec, options);

  const getStatus = async (spec: unknown) => {
    const artifacts = await store.ensure(spec);
    const apiRevision = createApiRevision(spec);
    return {
      apiRevision,
      generatedAt: artifacts.generatedAt,
      artifacts: {
        js: "/sdk/client.js",
        ts: "/sdk/client.ts",
        dts: "/sdk/client.d.ts"
      }
    };
  };

  return {
    ensureArtifacts,
    invalidate: () => store.invalidate(),
    regenerate: (spec: unknown) => store.ensure(spec, { force: true }),
    getStatus,
    getMeta: () => store.getMeta(),
    onOpenApiUpdate: async (spec: unknown) => {
      await store.ensure(spec);
    }
  };
}
