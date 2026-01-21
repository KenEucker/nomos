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
import type { ResolvedContract } from "./contract";

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
 * Contract registry for intent discovery.
 * Populated during route loading.
 */
export const contractRegistry: Map<string, ResolvedContract> = new Map();

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
 * Process a contract route module to derive handlers and register contracts.
 */
function processContractModule(
  routeModule: ContractRouteModule,
  routePath: string
): RouteModule {
  const contract = routeModule.__contract;
  const operations = routeModule.__operations ?? {};
  const isCollection = isCollectionRoute(routePath);

  // Register contract for intent discovery
  if (!contractRegistry.has(contract.id)) {
    contractRegistry.set(contract.id, contract);
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

  // Clear contract registry for fresh load
  contractRegistry.clear();

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
        const config: RouteDefinition["config"] = {
          auth: "required",
          ...(routeModule.config ?? {}),
          ...(methodConfig ?? {}),
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
          after: routeModule.after,
        });
      }
    }
  }

  return registry;
}

/**
 * Get all contracts from the registry.
 * Call after loadRoutes to get all registered contracts.
 */
export function getLoadedContracts(): ResolvedContract[] {
  return Array.from(contractRegistry.values());
}

/**
 * Get all intents from loaded contracts.
 * Call after loadRoutes to get all intents for seeding.
 */
export function getLoadedIntents(): string[] {
  const intents: Set<string> = new Set();

  for (const contract of contractRegistry.values()) {
    for (const intent of Object.values(contract.intents)) {
      if (intent) {
        intents.add(intent);
      }
    }
  }

  return Array.from(intents);
}
