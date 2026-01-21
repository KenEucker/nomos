import type { ZodSchema } from "zod";
import type { Handler } from "../ctx";

export type RouteConfig = {
  auth?: "required" | "optional" | "none";
  /**
   * The intent (permission) required to access this route.
   * Format: "resource.action" (e.g., "posts.read", "users.update")
   */
  intent?: string;
  middleware?: string[];
  validate?: {
    params?: ZodSchema<any>;
    query?: ZodSchema<any>;
    body?: ZodSchema<any>;
  };
  tags?: string[];
  summary?: string;
  description?: string;
  deprecated?: boolean;
  openapi?: {
    operation?: Record<string, any>;
    components?: Record<string, any>;
  };
};

export type RouteModule = {
  config?: RouteConfig;
  get?: Handler;
  post?: Handler;
  put?: Handler;
  patch?: Handler;
  del?: Handler;
  options?: Handler;
  head?: Handler;
  before?: Handler;
  after?: Handler;
  getConfig?: RouteConfig;
  postConfig?: RouteConfig;
  putConfig?: RouteConfig;
  patchConfig?: RouteConfig;
  delConfig?: RouteConfig;
  optionsConfig?: RouteConfig;
  headConfig?: RouteConfig;
};

export type RouteDefinition = {
  id: string;
  method: string;
  path: string;
  owner: string;
  handler: Handler;
  config: RouteConfig;
  before?: Handler;
  after?: Handler;
};
