import type { RouteRegistry } from "../router/registry.js";

export function buildOpenApi(registry: RouteRegistry) {
  const paths: Record<string, any> = {};
  for (const route of registry.routes) {
    const pathItem = paths[route.path] ?? {};
    pathItem[route.method] = {
      tags: route.config.tags ?? [route.owner],
      summary: route.config.summary ?? `${route.method.toUpperCase()} ${route.path}`,
      description: route.config.description,
      deprecated: route.config.deprecated ?? false,
      responses: {
        200: { description: "OK" }
      }
    };
    paths[route.path] = pathItem;
  }
  return {
    openapi: "3.0.0",
    info: {
      title: "Nomos Platform",
      version: "0.1.0"
    },
    paths
  };
}
