import type { AdminResourceInput } from "../../lib/resources/types";

export const errorsResource: AdminResourceInput = {
  id: "errors",
  label: "Errors",
  labelPlural: "Errors",
  menuGroup: "System",
  icon:
    '<svg class="flex-shrink-0 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
  endpoints: {
    list: "/_/errors",
  },
  requiredRole: "admin",
};
