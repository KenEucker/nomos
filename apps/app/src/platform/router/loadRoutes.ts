import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { filePathToRoute } from "./pathMapping.js";
import type { RouteDefinition, RouteModule } from "./routeTypes.js";
import { createRouteRegistry } from "./registry.js";

const METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head"
] as const;

type Method = (typeof METHODS)[number];

function collectFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

async function importRoute(filePath: string): Promise<RouteModule> {
  const mod = await import(pathToFileURL(filePath).href);
  return mod.default ?? mod;
}

export async function loadRoutes(
  baseDir: string,
  pluginRoutes: Array<{ baseDir: string; owner: string }>
) {
  const registry = createRouteRegistry();
  const sources = [
    { owner: "core", baseDir: path.join(baseDir, "routes") },
    ...pluginRoutes
  ];

  for (const source of sources) {
    if (!fs.existsSync(source.baseDir)) continue;
    const files = collectFiles(source.baseDir);
    for (const file of files) {
      const routeModule = await importRoute(file);
      const routePath = filePathToRoute(file, source.baseDir);
      for (const method of METHODS) {
        const configMethod = method === "delete" ? "del" : method;
        const handler = routeModule[configMethod];
        if (!handler) continue;
        const methodConfigKey = `${configMethod}Config` as keyof RouteModule;
        const methodConfig = routeModule[methodConfigKey];
        const config: RouteDefinition["config"] = {
          auth: "required",
          ...(routeModule.config ?? {}),
          ...(methodConfig ?? {})
        };
        const id = `${source.owner}:${method}:${routePath}`;
        registry.routes.push({
          id,
          method: method === "delete" ? "delete" : method,
          path: routePath,
          owner: source.owner,
          handler,
          config,
          before: routeModule.before,
          after: routeModule.after
        });
      }
    }
  }

  return registry;
}
