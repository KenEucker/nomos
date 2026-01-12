import type { RouteRegistry } from "../router/registry";

const baseComponents = {
  securitySchemes: {
    cookieAuth: {
      type: "apiKey",
      in: "cookie",
      name: "session_id"
    }
  },
  schemas: {
    ErrorEnvelope: {
      type: "object",
      properties: {
        ok: { type: "boolean", const: false },
        error: {
          type: "object",
          properties: {
            code: { type: "string" },
            message: { type: "string" },
            details: { type: "object", additionalProperties: true }
          },
          required: ["code", "message"]
        }
      },
      required: ["ok", "error"]
    },
    PaginationMeta: {
      type: "object",
      properties: {
        page: { type: "integer" },
        pageSize: { type: "integer" },
        total: { type: "integer" }
      },
      required: ["page", "pageSize", "total"]
    }
  }
};

function mergeComponents(target: Record<string, any>, source?: Record<string, any>) {
  if (!source) return;
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "object" && value && !Array.isArray(value)) {
      target[key] = target[key] ?? {};
      Object.assign(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

export function buildOpenApi(registry: RouteRegistry) {
  const paths: Record<string, any> = {};
  const components: Record<string, any> = JSON.parse(JSON.stringify(baseComponents));

  for (const route of registry.routes) {
    const pathItem = paths[route.path] ?? {};
    const operation: Record<string, any> = {
      tags: route.config.tags ?? [route.owner],
      summary: route.config.summary ?? `${route.method.toUpperCase()} ${route.path}`,
      description: route.config.description,
      deprecated: route.config.deprecated ?? false,
      responses: {
        200: { description: "OK" },
        400: {
          description: "Bad Request",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } }
        },
        401: {
          description: "Unauthorized",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } }
        },
        403: {
          description: "Forbidden",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } }
        },
        404: {
          description: "Not Found",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } }
        }
      }
    };

    if (route.config.validate?.body) {
      operation.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object"
            }
          }
        }
      };
    }
    if (route.path.startsWith("/api") && route.config.auth !== "none") {
      operation.security = [{ cookieAuth: [] }];
    }
    if (route.config.openapi?.operation) {
      const customOperation = route.config.openapi.operation;
      Object.assign(operation, customOperation);
      if (customOperation.responses) {
        operation.responses = { ...operation.responses, ...customOperation.responses };
      }
    }
    if (route.config.openapi?.components) {
      mergeComponents(components, route.config.openapi.components);
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
    components,
    paths
  };
}
