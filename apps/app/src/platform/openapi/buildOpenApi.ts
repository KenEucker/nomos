import type { ZodSchema } from "zod";
import type { RouteRegistry } from "../router/registry";

/**
 * Base OpenAPI components including security schemes and common schemas.
 */
const baseComponents = {
  securitySchemes: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "JWT token from /auth/dev/token (dev) or /auth/login",
    },
    apiKeyAuth: {
      type: "apiKey",
      in: "header",
      name: "X-API-Key",
      description: "API key for programmatic access",
    },
    cookieAuth: {
      type: "apiKey",
      in: "cookie",
      name: "session_id",
      description: "Session cookie (set by /auth/login)",
    },
  },
  schemas: {
    // Spec-compliant error schemas
    RateLimitExceededError: {
      type: "object",
      properties: {
        error: { type: "string", enum: ["rate_limit_exceeded"] },
        retryAfter: { type: "integer", description: "Seconds until rate limit resets" },
      },
      required: ["error", "retryAfter"],
    },
    UnauthorizedError: {
      type: "object",
      properties: {
        error: { type: "string", enum: ["unauthorized"] },
      },
      required: ["error"],
    },
    ForbiddenError: {
      type: "object",
      properties: {
        error: { type: "string", enum: ["forbidden"] },
        intent: { type: "string" },
        reason: { type: "string" },
      },
      required: ["error", "intent"],
    },
    ValidationError: {
      type: "object",
      properties: {
        error: { type: "string", enum: ["validation_error"] },
        details: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              message: { type: "string" },
            },
            required: ["path", "message"],
          },
        },
      },
      required: ["error", "details"],
    },
    NotFoundError: {
      type: "object",
      properties: {
        error: { type: "string", enum: ["not_found"] },
        resource: { type: "string" },
      },
      required: ["error"],
    },
    PaginationMeta: {
      type: "object",
      properties: {
        page: { type: "integer" },
        pageSize: { type: "integer" },
        total: { type: "integer" },
        totalPages: { type: "integer" },
      },
      required: ["page", "pageSize", "total", "totalPages"],
    },
  },
};

/**
 * Attempt to convert a Zod schema to JSON Schema.
 * This is a simplified conversion that handles common cases.
 */
function zodToJsonSchema(schema: ZodSchema<any>): Record<string, any> | null {
  try {
    const def = (schema as any)._def;
    if (!def) return null;

    const typeName = def.typeName;

    switch (typeName) {
      case "ZodString":
        return { type: "string" };

      case "ZodNumber":
        return { type: "number" };

      case "ZodBoolean":
        return { type: "boolean" };

      case "ZodArray": {
        const itemSchema = zodToJsonSchema(def.type);
        return { type: "array", items: itemSchema ?? {} };
      }

      case "ZodObject": {
        const shape = def.shape?.() ?? {};
        const properties: Record<string, any> = {};
        const required: string[] = [];

        for (const [key, value] of Object.entries(shape)) {
          const propSchema = zodToJsonSchema(value as ZodSchema<any>);
          if (propSchema) {
            properties[key] = propSchema;
            // Check if required (not optional)
            const propDef = (value as any)._def;
            if (propDef?.typeName !== "ZodOptional" && propDef?.typeName !== "ZodDefault") {
              required.push(key);
            }
          }
        }

        return {
          type: "object",
          properties,
          ...(required.length > 0 ? { required } : {}),
        };
      }

      case "ZodOptional":
        return zodToJsonSchema(def.innerType);

      case "ZodDefault":
        return zodToJsonSchema(def.innerType);

      case "ZodNullable": {
        const inner = zodToJsonSchema(def.innerType);
        if (inner) {
          return { ...inner, nullable: true };
        }
        return null;
      }

      case "ZodEnum":
        return { type: "string", enum: def.values };

      case "ZodLiteral":
        return { type: typeof def.value, const: def.value };

      case "ZodUnion": {
        const options = def.options?.map((opt: ZodSchema<any>) => zodToJsonSchema(opt)).filter(Boolean);
        if (options?.length) {
          return { oneOf: options };
        }
        return null;
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Extract path parameters from a route path.
 * Converts :param to OpenAPI parameter format.
 */
function extractPathParams(routePath: string): Array<{
  name: string;
  in: "path";
  required: true;
  schema: { type: string };
}> {
  const params: Array<{
    name: string;
    in: "path";
    required: true;
    schema: { type: string };
  }> = [];

  const matches = routePath.matchAll(/:(\w+)/g);
  for (const match of matches) {
    params.push({
      name: match[1],
      in: "path",
      required: true,
      schema: { type: "string" },
    });
  }

  return params;
}

/**
 * Merge components from route config into global components.
 */
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

/**
 * Build OpenAPI specification from route registry.
 */
export function buildOpenApi(registry: RouteRegistry) {
  const paths: Record<string, any> = {};
  const components: Record<string, any> = JSON.parse(JSON.stringify(baseComponents));

  for (const route of registry.routes) {
    const pathItem = paths[route.path] ?? {};

    // Extract path parameters
    const pathParams = extractPathParams(route.path);

    const operation: Record<string, any> = {
      tags: route.config.tags ?? [route.owner],
      summary: route.config.summary ?? `${route.method.toUpperCase()} ${route.path}`,
      description: route.config.description,
      deprecated: route.config.deprecated ?? false,
      parameters: [...pathParams],
      responses: {
        200: { description: "OK" },
        400: {
          description: "Validation Error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ValidationError" },
            },
          },
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UnauthorizedError" },
            },
          },
        },
        403: {
          description: "Forbidden",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ForbiddenError" },
            },
          },
        },
        404: {
          description: "Not Found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/NotFoundError" },
            },
          },
        },
        429: {
          description: "Rate Limit Exceeded",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RateLimitExceededError" },
            },
          },
        },
      },
    };

    // Add query parameters from validation schema
    if (route.config.validate?.query) {
      const querySchema = zodToJsonSchema(route.config.validate.query);
      if (querySchema?.properties) {
        for (const [name, schema] of Object.entries(querySchema.properties)) {
          const required = querySchema.required?.includes(name) ?? false;
          operation.parameters.push({
            name,
            in: "query",
            required,
            schema,
          });
        }
      }
    }

    // Add request body from validation schema
    if (route.config.validate?.body) {
      const bodySchema = zodToJsonSchema(route.config.validate.body);
      operation.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: bodySchema ?? { type: "object" },
          },
        },
      };
    }

    // Add security requirements for authenticated routes
    if (route.config.auth !== "none") {
      // API routes support all auth methods
      operation.security = [{ bearerAuth: [] }, { apiKeyAuth: [] }, { cookieAuth: [] }];
    }

    // Add intent to operation extensions
    if (route.config.intent) {
      operation["x-intent"] = route.config.intent;
    }

    // Merge custom OpenAPI operation config
    if (route.config.openapi?.operation) {
      const customOperation = route.config.openapi.operation;
      // Handle special merging for certain fields
      const { responses: customResponses, parameters: customParams, ...rest } = customOperation;

      Object.assign(operation, rest);

      if (customResponses) {
        operation.responses = { ...operation.responses, ...customResponses };
      }

      if (customParams) {
        operation.parameters = [...operation.parameters, ...customParams];
      }
    }

    // Merge custom components
    if (route.config.openapi?.components) {
      mergeComponents(components, route.config.openapi.components);
    }

    // Remove empty parameters array
    if (operation.parameters.length === 0) {
      delete operation.parameters;
    }

    pathItem[route.method] = operation;
    paths[route.path] = pathItem;
  }

  return {
    openapi: "3.0.0",
    info: {
      title: "Nomos Platform",
      version: "0.1.0",
    },
    components,
    paths,
  };
}
