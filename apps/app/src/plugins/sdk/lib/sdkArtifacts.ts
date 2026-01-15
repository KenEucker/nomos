import path from "node:path";
import fs from "node:fs/promises";
import openapiTS from "openapi-typescript";
import { createApiRevision } from "../../../platform/openapi/revision";
import { buildClientSource, buildClientTypeDeclarations } from "./clientTemplate";

const META_FILE = "metadata.json";
const CLIENT_JS = "client.js";
const CLIENT_TS = "client.ts";
const CLIENT_DTS = "client.d.ts";

type SdkArtifactsMeta = {
  revision: string;
  generatedAt: string;
};

export type SdkArtifacts = {
  revision: string;
  generatedAt: string;
  distDir: string;
  files: {
    js: string;
    ts: string;
    dts: string;
  };
};

type SdkArtifactsState = {
  loaded: boolean;
  meta: SdkArtifactsMeta | null;
};

const createState = (): SdkArtifactsState => ({
  loaded: false,
  meta: null
});

async function loadMeta(distDir: string, state: SdkArtifactsState) {
  if (state.loaded) return;
  state.loaded = true;
  try {
    const payload = await fs.readFile(path.join(distDir, META_FILE), "utf-8");
    state.meta = JSON.parse(payload) as SdkArtifactsMeta;
  } catch {
    state.meta = null;
  }
}

async function artifactsExist(distDir: string) {
  const targets = [CLIENT_JS, CLIENT_TS, CLIENT_DTS].map((file) => path.join(distDir, file));
  try {
    await Promise.all(targets.map((file) => fs.access(file)));
    return true;
  } catch {
    return false;
  }
}

async function writeArtifacts(
  distDir: string,
  revision: string,
  spec: any,
  state: SdkArtifactsState
) {
  await fs.mkdir(distDir, { recursive: true });
  const types = await openapiTS(spec);
  const typeDeclarations = `${types}\n${buildClientTypeDeclarations()}`;
  const clientJs = buildClientSource({ includeTypes: false });
  const clientTs = buildClientSource({ includeTypes: true });

  await Promise.all([
    fs.writeFile(path.join(distDir, CLIENT_JS), clientJs, "utf-8"),
    fs.writeFile(path.join(distDir, CLIENT_TS), clientTs, "utf-8"),
    fs.writeFile(path.join(distDir, CLIENT_DTS), typeDeclarations, "utf-8")
  ]);

  const generatedAt = new Date().toISOString();
  state.meta = { revision, generatedAt };
  await fs.writeFile(path.join(distDir, META_FILE), JSON.stringify(state.meta, null, 2), "utf-8");

  return state.meta;
}

export function createSdkArtifactsStore(distDir: string) {
  const state = createState();

  const ensure = async (spec: unknown, options?: { force?: boolean }) => {
    await loadMeta(distDir, state);
    const revision = createApiRevision(spec);
    const hasArtifacts = await artifactsExist(distDir);
    const force = options?.force ?? false;

    if (!force && state.meta?.revision === revision && hasArtifacts) {
      return toArtifacts(distDir, state.meta);
    }

    const meta = await writeArtifacts(distDir, revision, spec, state);
    return toArtifacts(distDir, meta);
  };

  const invalidate = async () => {
    state.meta = null;
    state.loaded = true;
    await fs.rm(distDir, { recursive: true, force: true });
  };

  const getMeta = async () => {
    await loadMeta(distDir, state);
    return state.meta;
  };

  return {
    ensure,
    invalidate,
    getMeta
  };
}

function toArtifacts(distDir: string, meta: SdkArtifactsMeta) {
  return {
    revision: meta.revision,
    generatedAt: meta.generatedAt,
    distDir,
    files: {
      js: path.join(distDir, CLIENT_JS),
      ts: path.join(distDir, CLIENT_TS),
      dts: path.join(distDir, CLIENT_DTS)
    }
  };
}
