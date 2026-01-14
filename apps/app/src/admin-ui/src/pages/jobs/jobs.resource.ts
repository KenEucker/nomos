import type { AdminResourceInput } from "../../lib/resources/types";

export const jobsResource: AdminResourceInput = {
  id: "jobs",
  label: "Job",
  labelPlural: "Jobs",
  icon: "clock",
  endpoints: {
    list: "/_/jobs",
  },
  requiredRole: "admin",
};
