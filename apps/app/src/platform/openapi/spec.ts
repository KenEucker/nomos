import type { RouteRegistry } from "../router/registry";
import { buildOpenApi } from "./buildOpenApi";

export const OPENAPI_JSON_PATH = "/openapi.json";
export const OPENAPI_DOCS_PATH = "/docs";

let cachedOpenApi: ReturnType<typeof buildOpenApi> | null = null;

export function buildOpenApiSpec(registry: RouteRegistry) {
  cachedOpenApi = buildOpenApi(registry);
  return cachedOpenApi;
}

export function getOpenApiSpec() {
  if (!cachedOpenApi) {
    throw new Error("OpenAPI spec has not been initialized");
  }
  return cachedOpenApi;
}
