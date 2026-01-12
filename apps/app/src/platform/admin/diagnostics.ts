import type { RouteRegistry } from "../router/registry";
import type { EventBus } from "../events/bus";
import type { JobsRuntime } from "../jobs/runtime";

export function buildDiagnostics(routeRegistry: RouteRegistry, bus: EventBus, jobs: JobsRuntime) {
  return {
    routes: routeRegistry.routes.map((route) => ({
      id: route.id,
      method: route.method,
      path: route.path,
      owner: route.owner
    })),
    events: Array.from((bus as any).listeners?.keys?.() ?? []),
    jobs: jobs.list()
  };
}
