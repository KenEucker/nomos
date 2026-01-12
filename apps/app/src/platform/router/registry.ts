import type { RouteDefinition } from "./routeTypes";

export type RouteRegistry = {
  routes: RouteDefinition[];
};

export function createRouteRegistry(): RouteRegistry {
  return { routes: [] };
}
