import type { ZodSchema } from "zod";
import type { Handler } from "../ctx";
import type { RouteConfig, RouteModule } from "./routeTypes";
import type { ResolvedContract } from "./contract";

/**
 * Rate limit configuration for an operation.
 */
export type RateLimitConfig = {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests allowed in the window */
  maxRequests: number;
};

/**
 * Validation configuration for an operation.
 */
export type ValidateConfig = {
  params?: ZodSchema<any>;
  query?: ZodSchema<any>;
  body?: ZodSchema<any>;
};

/**
 * Configuration for a contract-derived CRUD operation.
 */
export type OperationConfig = {
  /**
   * The intent string for authorization.
   * If not provided, derived from the contract.
   */
  intent?: string;
  /**
   * Validation schemas for this operation.
   * Can reference contract schemas or provide custom ones.
   */
  validate?: ValidateConfig;
  /**
   * Prisma model name for auto-generated handlers.
   * If omitted, a handler must be provided.
   */
  model?: string;
  /**
   * Custom handler implementation.
   * If provided, overrides auto-generated handler.
   */
  handler?: Handler;
  /**
   * Rate limit override for this operation.
   */
  rateLimit?: RateLimitConfig;
  /**
   * OpenAPI summary for this operation.
   */
  summary?: string;
  /**
   * OpenAPI description for this operation.
   */
  description?: string;
  /**
   * Mark this operation as deprecated in OpenAPI.
   */
  deprecated?: boolean;
};

/**
 * Operations configuration for defineRoute.
 * Each HTTP method can have its own operation config.
 */
export type OperationsConfig = {
  get?: OperationConfig;
  post?: OperationConfig;
  put?: OperationConfig;
  patch?: OperationConfig;
  delete?: OperationConfig;
};

/**
 * Custom handlers configuration for defineRoute.
 * Use this when you need full control over handlers.
 */
export type HandlersConfig = {
  get?: Handler;
  post?: Handler;
  put?: Handler;
  patch?: Handler;
  delete?: Handler;
};

/**
 * Options for defineRoute.
 *
 * You can use either:
 * - `operations`: For contract-derived handlers with optional overrides
 * - `handlers`: For fully custom handlers
 *
 * Both can be combined, with handlers taking precedence.
 */
export type DefineRouteOptions = {
  /**
   * Contract-derived operation configurations.
   * Handlers can be auto-generated if `model` is provided.
   */
  operations?: OperationsConfig;
  /**
   * Fully custom handlers.
   * These override any auto-generated handlers.
   */
  handlers?: HandlersConfig;
  /**
   * Default authentication requirement for all operations.
   * @default "required"
   */
  auth?: "required" | "optional" | "none";
  /**
   * Middleware to apply to all operations.
   */
  middleware?: string[];
  /**
   * Before hook for all operations.
   */
  before?: Handler;
  /**
   * After hook for all operations.
   */
  after?: Handler;
};

/**
 * Internal: Result from building an operation
 */
type BuiltOperation = {
  handler: Handler;
  config: RouteConfig;
};

/**
 * Build a route config from an operation config.
 */
function buildOperationConfig(
  contract: ResolvedContract,
  method: keyof OperationsConfig,
  opConfig: OperationConfig,
  defaultAuth: "required" | "optional" | "none",
  defaultMiddleware?: string[]
): RouteConfig {
  // Map HTTP method to intent operation
  const intentMap: Record<keyof OperationsConfig, keyof ResolvedContract["intents"]> = {
    get: "list", // GET on collection = list, GET with :id = read (handled separately)
    post: "create",
    put: "update",
    patch: "update",
    delete: "delete",
  };

  // Determine intent
  let intent = opConfig.intent;
  if (!intent) {
    const intentOp = intentMap[method];
    intent = contract.intents[intentOp];
  }

  // Build config
  const config: RouteConfig = {
    auth: defaultAuth,
    tags: contract.tags,
  };

  if (intent) {
    config.intent = intent;
  }

  if (opConfig.validate) {
    config.validate = opConfig.validate;
  }

  if (opConfig.summary) {
    config.summary = opConfig.summary;
  }

  if (opConfig.description) {
    config.description = opConfig.description;
  }

  if (opConfig.deprecated) {
    config.deprecated = opConfig.deprecated;
  }

  if (defaultMiddleware && defaultMiddleware.length > 0) {
    config.middleware = defaultMiddleware;
  }

  // Store rate limit in openapi.operation for later extraction
  if (opConfig.rateLimit) {
    config.openapi = {
      ...config.openapi,
      operation: {
        ...config.openapi?.operation,
        "x-rate-limit": opConfig.rateLimit,
      },
    };
  }

  // Store model in openapi.operation for handler derivation
  if (opConfig.model) {
    config.openapi = {
      ...config.openapi,
      operation: {
        ...config.openapi?.operation,
        "x-model": opConfig.model,
      },
    };
  }

  return config;
}

/**
 * Symbol to identify route modules created by defineRoute.
 */
export const DEFINE_ROUTE_SYMBOL = Symbol.for("nomos:defineRoute");

/**
 * Extended RouteModule with contract metadata.
 */
export interface ContractRouteModule extends RouteModule {
  /** Symbol identifying this as a defineRoute module */
  [DEFINE_ROUTE_SYMBOL]: true;
  /** The contract this route is derived from */
  __contract: ResolvedContract;
  /** The operation configs for handler derivation */
  __operations?: OperationsConfig;
}

/**
 * Define a route module from a contract.
 *
 * This is the primary way to create API routes in Nomos.
 * It accepts an API contract and configuration, returning
 * a RouteModule compatible with the platform loader.
 *
 * @example
 * ```ts
 * // With auto-generated handlers
 * export default defineRoute(usersContract, {
 *   operations: {
 *     get: {
 *       intent: usersContract.intents.list,
 *       validate: { query: usersContract.schema.queryList },
 *       model: "User",
 *     },
 *     post: {
 *       intent: usersContract.intents.create,
 *       validate: { body: usersContract.schema.createBody },
 *       model: "User",
 *     },
 *   },
 * });
 *
 * // With custom handlers
 * export default defineRoute(usersContract, {
 *   handlers: {
 *     get: async (ctx) => {
 *       // Custom implementation
 *     },
 *   },
 * });
 *
 * // Mixed: operations with handler override
 * export default defineRoute(usersContract, {
 *   operations: {
 *     get: {
 *       intent: usersContract.intents.list,
 *       validate: { query: usersContract.schema.queryList },
 *       handler: async (ctx) => {
 *         // Custom implementation with contract validation
 *       },
 *     },
 *   },
 * });
 * ```
 */
export function defineRoute(
  contract: ResolvedContract,
  options: DefineRouteOptions
): ContractRouteModule {
  const {
    operations = {},
    handlers = {},
    auth = "required",
    middleware,
    before,
    after,
  } = options;

  const module: ContractRouteModule = {
    [DEFINE_ROUTE_SYMBOL]: true,
    __contract: contract,
    __operations: operations,
    config: {
      auth,
      tags: contract.tags,
      middleware,
    },
    before,
    after,
  };

  // Process each HTTP method
  const methods = ["get", "post", "put", "patch", "delete"] as const;

  for (const method of methods) {
    const opConfig = operations[method];
    const customHandler = handlers[method];

    // Skip if neither operation nor handler defined
    if (!opConfig && !customHandler) {
      continue;
    }

    // Build method-specific config
    if (opConfig) {
      const configKey = (method === "delete" ? "del" : method) + "Config" as keyof RouteModule;
      (module as any)[configKey] = buildOperationConfig(
        contract,
        method,
        opConfig,
        auth,
        middleware
      );
    }

    // Determine handler
    // Priority: custom handler > operation handler > auto-generated (via model)
    const handlerKey = method === "delete" ? "del" : method;

    if (customHandler) {
      (module as any)[handlerKey] = customHandler;
    } else if (opConfig?.handler) {
      (module as any)[handlerKey] = opConfig.handler;
    } else if (opConfig?.model) {
      // Handler will be generated at load time by restHandlers
      // For now, set a placeholder that will be replaced
      (module as any)[handlerKey] = createPlaceholderHandler(method, opConfig.model);
    }
  }

  return module;
}

/**
 * Create a placeholder handler that will be replaced by auto-generated handler.
 * This allows loadRoutes to identify handlers that need derivation.
 */
function createPlaceholderHandler(method: string, model: string): Handler {
  const handler: Handler & { __derive?: { method: string; model: string } } = async (ctx) => {
    ctx.error(500, "not_implemented", `Handler for ${method} on ${model} not derived`);
  };
  handler.__derive = { method, model };
  return handler;
}

/**
 * Check if a handler needs to be derived from a model.
 */
export function needsDerivation(handler: Handler): handler is Handler & { __derive: { method: string; model: string } } {
  return "__derive" in handler;
}

/**
 * Check if a route module was created by defineRoute.
 */
export function isContractRouteModule(module: RouteModule): module is ContractRouteModule {
  return DEFINE_ROUTE_SYMBOL in module && (module as any)[DEFINE_ROUTE_SYMBOL] === true;
}

/**
 * Get rate limit config from a route config if present.
 */
export function getRateLimitConfig(config: RouteConfig): RateLimitConfig | undefined {
  return config.openapi?.operation?.["x-rate-limit"];
}

/**
 * Get model name from a route config if present.
 */
export function getModelName(config: RouteConfig): string | undefined {
  return config.openapi?.operation?.["x-model"];
}
