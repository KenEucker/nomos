import type { AdminResourceInput } from "../../lib/resources/types";

export const diagnosticsResource: AdminResourceInput = {
  id: "diagnostics",
  label: "Diagnostics",
  labelPlural: "Diagnostics",
  icon: "activity",
  endpoints: {
    list: "/_/diagnostics",
  },
  requiredRole: "admin",
};
