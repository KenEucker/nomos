import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ResolvedNomosConfig } from "../config/nomos-config";
import type { DiscoveredPlugin, PluginManifest } from "./types";

type DiscoveryCache = {
  key: string;
  plugins: DiscoveredPlugin[];
};

let cache: DiscoveryCache | null = null;

const expandPattern = (pattern: string) => {
  const match = pattern.match(/\/?([^/]+)\.(\{[^}]+\}|[^/]+)$/);
  if (!match) return [];
  const base = match[1];
  const extRaw = match[2];
  const exts = extRaw.startsWith("{")
    ? extRaw.slice(1, -1).split(",").map((value) => value.trim())
    : [extRaw];
  return exts.map((ext) => `${base}.${ext}`);
};

const buildCandidateFiles = (patterns: string[]) => {
  const candidates = new Set<string>();
  for (const pattern of patterns) {
    for (const file of expandPattern(pattern)) {
      candidates.add(file);
    }
  }
  return Array.from(candidates);
};

const importPluginModule = async (entryPath: string) => {
  if (entryPath.endsWith(".ts")) {
    const { tsImport } = await import("tsx/esm/api");
    return tsImport(pathToFileURL(entryPath).href, import.meta.url);
  }
  return import(pathToFileURL(entryPath).href);
};

const resolveManifest = (mod: Record<string, unknown> | null): PluginManifest | null => {
  if (!mod) return null;
  const manifest =
    (mod.default as PluginManifest | undefined) ??
    (mod.plugin as PluginManifest | undefined) ??
    (mod.manifest as PluginManifest | undefined) ??
    (mod as PluginManifest);
  if (!manifest || typeof manifest !== "object") return null;
  return manifest;
};

export const discoverPlugins = async (
  config: ResolvedNomosConfig,
  options: { force?: boolean } = {}
): Promise<DiscoveredPlugin[]> => {
  const discovery = config.modules.pluginManager.discovery;
  const pluginDir = path.resolve(process.cwd(), discovery.pluginDir);
  const candidateFiles = buildCandidateFiles(discovery.includePatterns);
  const cacheKey = JSON.stringify({ pluginDir, candidateFiles });

  if (cache && cache.key === cacheKey && !options.force) {
    return cache.plugins;
  }

  if (!fs.existsSync(pluginDir)) {
    cache = { key: cacheKey, plugins: [] };
    return [];
  }

  const folders = fs
    .readdirSync(pluginDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const results: DiscoveredPlugin[] = [];

  for (const folder of folders) {
    const folderPath = path.join(pluginDir, folder);
    const entryName = candidateFiles.find((file) => fs.existsSync(path.join(folderPath, file)));
    if (!entryName) continue;

    const entryPath = path.join(folderPath, entryName);
    const mod = await importPluginModule(entryPath).catch((error: Error) => ({
      error
    }));

    const error =
      mod && "error" in mod && mod.error instanceof Error
        ? mod.error.message
        : undefined;
    const manifest = error ? null : resolveManifest(mod as Record<string, unknown>);
    const slug = manifest?.slug ?? folder;
    if (manifest && !manifest.slug) {
      manifest.slug = slug;
    }

    results.push({
      slug,
      folderPath,
      entryPath,
      manifest,
      error
    });
  }

  cache = { key: cacheKey, plugins: results };
  return results;
};
