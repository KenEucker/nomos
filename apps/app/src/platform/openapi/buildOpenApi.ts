import type { RouteRegistry } from "../router/registry.js";

export function buildOpenApi(registry: RouteRegistry) {
  const paths: Record<string, any> = {};
  for (const route of registry.routes) {
    const pathItem = paths[route.path] ?? {};
    const operation: Record<string, any> = {
      tags: route.config.tags ?? [route.owner],
      summary: route.config.summary ?? `${route.method.toUpperCase()} ${route.path}`,
      description: route.config.description,
      deprecated: route.config.deprecated ?? false,
      responses: {
        200: { description: "OK" }
      }
    };
    if (route.path.startsWith("/api") && route.config.auth !== "none") {
      operation.security = [{ bearerAuth: [] }];
      operation.responses[401] = { description: "Unauthorized" };
    }
    pathItem[route.method] = operation;
    paths[route.path] = pathItem;
  }
  return {
    openapi: "3.0.0",
    info: {
      title: "Nomos Platform",
      version: "0.1.0"
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    },
    paths
  };
}
