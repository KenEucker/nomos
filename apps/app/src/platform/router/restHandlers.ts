import type { Handler, Ctx } from "../ctx";
import type { ResolvedContract, ContractSchema } from "./contract";
import type { OperationConfig } from "./defineRoute";

/**
 * Configuration for REST handler derivation.
 */
export type RestHandlerConfig = {
  /** The contract for this route */
  contract: ResolvedContract;
  /** The HTTP method */
  method: "get" | "post" | "put" | "patch" | "delete";
  /** The Prisma model name */
  model: string;
  /** The operation config */
  operation: OperationConfig;
  /** Whether this is a collection route (no :id param) or item route */
  isCollection: boolean;
};

/**
 * Allowed fields configuration for filtering/sorting.
 * Derived from the contract's entity schema if possible.
 */
export type AllowedFields = {
  filter: string[];
  sort: string[];
};

/**
 * Get allowed fields from a contract schema.
 * Extracts field names from the entity schema.
 */
export function getAllowedFields(schema: ContractSchema): AllowedFields {
  const fields: AllowedFields = {
    filter: [],
    sort: [],
  };

  // Try to extract field names from entity schema
  if (schema.entity) {
    try {
      const shape = (schema.entity as any)._def?.shape?.();
      if (shape) {
        const names = Object.keys(shape);
        fields.filter = names;
        fields.sort = names;
      }
    } catch {
      // Schema doesn't expose shape, fall back to empty
    }
  }

  return fields;
}

/**
 * Parse sort parameter into Prisma orderBy format.
 */
function parseSort(
  sort: string | undefined,
  allowedFields: string[]
): Record<string, "asc" | "desc"> | undefined {
  if (!sort) return undefined;

  const [field, direction] = sort.split(":");
  if (!field || !allowedFields.includes(field)) return undefined;

  return { [field]: direction === "desc" ? "desc" : "asc" };
}

/**
 * Build Prisma where clause from query parameters.
 */
function buildWhereClause(
  query: Record<string, any>,
  allowedFields: string[]
): Record<string, any> {
  const where: Record<string, any> = {};

  // Handle search parameter (common pattern)
  if (query.search && typeof query.search === "string" && query.search.trim()) {
    // Search is typically handled per-model, but we can provide a basic pattern
    // This will be customized per-route if needed
    where.OR = allowedFields
      .filter((f) => f !== "id" && f !== "createdAt" && f !== "updatedAt")
      .slice(0, 3) // Limit to first 3 text-like fields
      .map((field) => ({
        [field]: { contains: query.search, mode: "insensitive" },
      }));

    // If no fields to search, remove OR
    if (where.OR.length === 0) {
      delete where.OR;
    }
  }

  // Handle explicit filter parameters
  for (const [key, value] of Object.entries(query)) {
    if (
      key === "page" ||
      key === "pageSize" ||
      key === "sort" ||
      key === "search" ||
      value === undefined
    ) {
      continue;
    }

    if (allowedFields.includes(key)) {
      where[key] = value;
    }
  }

  return where;
}

/**
 * Get Prisma delegate from context by model name.
 */
function getPrismaDelegate(ctx: Ctx, model: string): any {
  const delegate = (ctx.prisma as any)[model.toLowerCase()];
  if (!delegate) {
    throw new Error(`Prisma model "${model}" not found`);
  }
  return delegate;
}

/**
 * Create a list handler for a collection endpoint.
 *
 * Handles: GET /resource
 * Returns: Paginated list of items
 */
export function createListHandler(config: RestHandlerConfig): Handler {
  const { contract, model } = config;
  const allowedFields = getAllowedFields(contract.schema);

  return async (ctx: Ctx) => {
    const { page = 1, pageSize = 20, sort, ...filters } = ctx.query;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where = buildWhereClause(filters, allowedFields.filter);
    const orderBy = parseSort(sort, allowedFields.sort);

    const delegate = getPrismaDelegate(ctx, model);

    const [total, items] = await Promise.all([
      delegate.count({ where }),
      delegate.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
    ]);

    return ctx.json(
      { items },
      200,
      {
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      }
    );
  };
}

/**
 * Create a read handler for a single item endpoint.
 *
 * Handles: GET /resource/:id
 * Returns: Single item
 */
export function createReadHandler(config: RestHandlerConfig): Handler {
  const { model } = config;

  return async (ctx: Ctx) => {
    const { id } = ctx.params;

    const delegate = getPrismaDelegate(ctx, model);
    const item = await delegate.findUnique({ where: { id } });

    if (!item) {
      ctx.error(404, "not_found", `${model} not found`);
    }

    return ctx.json(item);
  };
}

/**
 * Create a create handler for a collection endpoint.
 *
 * Handles: POST /resource
 * Returns: Created item
 */
export function createCreateHandler(config: RestHandlerConfig): Handler {
  const { model } = config;

  return async (ctx: Ctx) => {
    const data = ctx.body;

    const delegate = getPrismaDelegate(ctx, model);
    const created = await delegate.create({ data });

    return ctx.json(created, 201);
  };
}

/**
 * Create an update handler for a single item endpoint.
 *
 * Handles: PUT /resource/:id or PATCH /resource/:id
 * Returns: Updated item
 */
export function createUpdateHandler(config: RestHandlerConfig): Handler {
  const { model } = config;

  return async (ctx: Ctx) => {
    const { id } = ctx.params;
    const data = ctx.body;

    const delegate = getPrismaDelegate(ctx, model);

    // Check existence first
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) {
      ctx.error(404, "not_found", `${model} not found`);
    }

    const updated = await delegate.update({
      where: { id },
      data,
    });

    return ctx.json(updated);
  };
}

/**
 * Create a delete handler for a single item endpoint.
 *
 * Handles: DELETE /resource/:id
 * Returns: Success response
 */
export function createDeleteHandler(config: RestHandlerConfig): Handler {
  const { model } = config;

  return async (ctx: Ctx) => {
    const { id } = ctx.params;

    const delegate = getPrismaDelegate(ctx, model);

    // Check existence first
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) {
      ctx.error(404, "not_found", `${model} not found`);
    }

    await delegate.delete({ where: { id } });

    return ctx.json({ deleted: true });
  };
}

/**
 * Derive a handler based on method and whether it's a collection route.
 */
export function deriveHandler(config: RestHandlerConfig): Handler {
  const { method, isCollection } = config;

  switch (method) {
    case "get":
      return isCollection
        ? createListHandler(config)
        : createReadHandler(config);
    case "post":
      return createCreateHandler(config);
    case "put":
    case "patch":
      return createUpdateHandler(config);
    case "delete":
      return createDeleteHandler(config);
    default:
      throw new Error(`Cannot derive handler for method: ${method}`);
  }
}

/**
 * Check if a route path is a collection route (no :id parameter).
 */
export function isCollectionRoute(path: string): boolean {
  return !path.includes(":id") && !path.endsWith("/[id]");
}
