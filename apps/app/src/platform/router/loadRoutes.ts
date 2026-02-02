import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { filePathToRoute } from "./pathMapping";
import type { RouteDefinition, RouteModule } from "./routeTypes";
import { createRouteRegistry } from "./registry";
import {
  isContractRouteModule,
  needsDerivation,
  type ContractRouteModule,
} from "./defineRoute";
import { deriveHandler, isCollectionRoute } from "./restHandlers";

const METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
] as const;

type Method = (typeof METHODS)[number];

/**
 * Discovered intents from contracts and route configs during loadRoutes.
 * getLoadedIntents() returns these; nothing is stored for later lookup.
 */
const discoveredIntents: Set<string> = new Set();

function collectFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      // Skip contract files - they are imported by route files
      if (entry.name.endsWith(".contract.ts")) {
        continue;
      }
      results.push(fullPath);
    }
  }
  return results;
}

async function importRoute(filePath: string): Promise<RouteModule> {
  const mod = await import(pathToFileURL(filePath).href);
  return mod.default ?? mod;
}

/**
 * Process a contract route module to derive handlers and discover intents from the contract.
 */
function processContractModule(
  routeModule: ContractRouteModule,
  routePath: string
): RouteModule {
  const contract = routeModule.__contract;
  const operations = routeModule.__operations ?? {};
  const isCollection = isCollectionRoute(routePath);

  // Discover intents from contract (no registry)
  for (const intent of Object.values(contract.intents)) {
    if (intent) {
      discoveredIntents.add(intent);
    }
  }

  // Process each method to derive handlers if needed
  const methods = ["get", "post", "put", "patch", "delete"] as const;

  for (const method of methods) {
    const handlerKey = method === "delete" ? "del" : method;
    const handler = (routeModule as any)[handlerKey];
    const opConfig = operations[method];

    if (handler && needsDerivation(handler) && opConfig?.model) {
      // Derive the handler
      const derivedHandler = deriveHandler({
        contract,
        method,
        model: opConfig.model,
        operation: opConfig,
        isCollection,
      });

      (routeModule as any)[handlerKey] = derivedHandler;
    }
  }

  return routeModule;
}

export async function loadRoutes(
  baseDir: string,
  pluginRoutes: Array<{ baseDir: string; owner: string }>
) {
  const registry = createRouteRegistry();
  const sources = [
    { owner: "core", baseDir: path.join(baseDir, "routes") },
    ...pluginRoutes,
  ];

  discoveredIntents.clear();

  for (const source of sources) {
    if (!fs.existsSync(source.baseDir)) continue;
    const files = collectFiles(source.baseDir);
    for (const file of files) {
      let routeModule = await importRoute(file);
      const routePath = filePathToRoute(file, source.baseDir);

      // Process contract route modules
      if (isContractRouteModule(routeModule)) {
        routeModule = processContractModule(routeModule, routePath);
      }

      for (const method of METHODS) {
        const configMethod = method === "delete" ? "del" : method;
        const handler = routeModule[configMethod];
        if (!handler) continue;
        const methodConfigKey = `${configMethod}Config` as keyof RouteModule;
        const methodConfig = routeModule[methodConfigKey];
        const moduleIntent =
          routeModule.intents && method !== "options" && method !== "head"
            ? routeModule.intents[method as keyof typeof routeModule.intents]
            : undefined;
        const config: RouteDefinition["config"] = {
          auth: "required",
          ...(routeModule.config ?? {}),
          ...(moduleIntent ? { intent: moduleIntent } : {}),
          ...(methodConfig ?? {}),
        };
        const id = `${source.owner}:${method}:${routePath}`;
        if (config.intent) {
          discoveredIntents.add(config.intent);
        }
        registry.routes.push({
          id,
          method: method === "delete" ? "delete" : method,
          path: routePath,
          owner: source.owner,
          handler,
          config,
          before: routeModule.before,
          after: routeModule.after,
        });
      }
    }
  }

  return registry;
}

/**
 * Return intents discovered during loadRoutes (from contracts and route configs).
 * Call after loadRoutes so intents are available for seeding.
 */
export function getLoadedIntents(): string[] {
  return Array.from(discoveredIntents);
}
