import type { ZodSchema } from "zod";

/**
 * Intent configuration for a contract.
 * - `true` means the intent is enabled and will be derived from the contract ID
 * - `false` means the intent is disabled
 * - A string means the intent is enabled with a custom intent name
 *
 * By default, only `read` is enabled (true). All others default to false.
 */
export type IntentConfig = {
  /** List/read collection - defaults to true */
  list?: boolean | string;
  /** Read single item - defaults to true */
  read?: boolean | string;
  /** Create new item - defaults to false */
  create?: boolean | string;
  /** Update existing item - defaults to false */
  update?: boolean | string;
  /** Delete item - defaults to false */
  delete?: boolean | string;
};

/**
 * Resolved intents with actual intent strings.
 * Only includes intents that are enabled.
 */
export type ResolvedIntents = {
  list?: string;
  read?: string;
  create?: string;
  update?: string;
  delete?: string;
};

/**
 * Schema definitions for an API contract.
 * Standard schema keys are provided for common CRUD patterns,
 * but custom schemas can be added as needed.
 */
export type ContractSchema = {
  /** Schema for ID parameter (e.g., { id: z.string() }) */
  paramsId?: ZodSchema<any>;
  /** Schema for list query parameters */
  queryList?: ZodSchema<any>;
  /** Schema for create request body */
  createBody?: ZodSchema<any>;
  /** Schema for update request body */
  updateBody?: ZodSchema<any>;
  /** Schema for a single entity response */
  entity?: ZodSchema<any>;
  /** Schema for list response */
  listResponse?: ZodSchema<any>;
  /** Additional custom schemas */
  [key: string]: ZodSchema<any> | undefined;
};

/**
 * API Contract definition.
 * Contracts are the source of truth for API endpoints.
 */
export interface ApiContract {
  /** Unique identifier for this contract (e.g., "users", "posts") */
  id: string;
  /** OpenAPI tags for grouping endpoints */
  tags: string[];
  /** Intent configuration - which operations are allowed */
  intents?: IntentConfig;
  /** Zod schemas for validation and OpenAPI generation */
  schema: ContractSchema;
  /** Optional description for OpenAPI */
  description?: string;
}

/**
 * Contract with resolved intents (after defaults are applied).
 */
export interface ResolvedContract extends Omit<ApiContract, "intents"> {
  /** Resolved intent strings (only enabled intents included) */
  intents: ResolvedIntents;
}

/**
 * Default intent configuration.
 * Only read operations are enabled by default.
 */
const DEFAULT_INTENTS: Required<IntentConfig> = {
  list: true,
  read: true,
  create: false,
  update: false,
  delete: false,
};

/**
 * Resolve intent configuration to actual intent strings.
 *
 * @param id - The contract ID (used as prefix for derived intents)
 * @param config - The intent configuration
 * @returns Resolved intents with actual intent strings
 */
function resolveIntents(id: string, config?: IntentConfig): ResolvedIntents {
  const merged = { ...DEFAULT_INTENTS, ...config };
  const resolved: ResolvedIntents = {};

  const operations = ["list", "read", "create", "update", "delete"] as const;

  for (const op of operations) {
    const value = merged[op];
    if (value === false) {
      // Intent disabled, skip
      continue;
    } else if (value === true) {
      // Derive intent from contract ID
      resolved[op] = `${id}.${op}`;
    } else if (typeof value === "string") {
      // Custom intent string provided
      resolved[op] = value;
    }
  }

  return resolved;
}

/**
 * Define an API contract.
 *
 * Contracts are declarative objects that describe:
 * - Request schemas (params, query, body)
 * - Response schemas
 * - Intent declarations for authorization
 * - OpenAPI metadata
 *
 * @example
 * ```ts
 * export const usersContract = defineContract({
 *   id: "users",
 *   tags: ["Users"],
 *   intents: {
 *     list: true,    // Derives "users.list"
 *     read: true,    // Derives "users.read" (default)
 *     create: true,  // Derives "users.create"
 *     update: true,  // Derives "users.update"
 *     delete: false, // Disabled
 *   },
 *   schema: {
 *     paramsId: z.object({ id: z.string() }),
 *     queryList: z.object({
 *       page: z.coerce.number().default(1),
 *       pageSize: z.coerce.number().default(20),
 *       search: z.string().optional(),
 *     }),
 *     createBody: z.object({
 *       email: z.string().email(),
 *       name: z.string().min(1),
 *     }),
 *     entity: z.object({
 *       id: z.string(),
 *       email: z.string(),
 *       name: z.string(),
 *     }),
 *   },
 * });
 * ```
 */
export function defineContract(contract: ApiContract): ResolvedContract {
  return {
    ...contract,
    intents: resolveIntents(contract.id, contract.intents),
  };
}

/**
 * Get all enabled intents from a contract as an array.
 * Useful for intent discovery and seeding.
 */
export function getContractIntents(contract: ResolvedContract): string[] {
  return Object.values(contract.intents).filter((v): v is string => typeof v === "string");
}
