import type { RouteDefinition } from "./routeTypes.js";

export type RouteRegistry = {
  routes: RouteDefinition[];
};

export function createRouteRegistry(): RouteRegistry {
  return { routes: [] };
}
