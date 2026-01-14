import type { AdminResourceInput } from "../../lib/resources/types";

export const routesResource: AdminResourceInput = {
  id: "routes",
  label: "Routes",
  labelPlural: "Routes",
  icon:
    '<svg class="flex-shrink-0 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>',
  endpoints: {
    list: "/_/routes",
  },
  requiredRole: "admin",
};
