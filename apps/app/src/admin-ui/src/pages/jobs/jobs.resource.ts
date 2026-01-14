import type { AdminResourceInput } from "../../lib/resources/types";

export const jobsResource: AdminResourceInput = {
  id: "jobs",
  label: "Job",
  labelPlural: "Jobs",
  menuGroup: "System",
  icon:
    '<svg class="flex-shrink-0 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  endpoints: {
    list: "/_/jobs",
  },
  requiredRole: "admin",
};
