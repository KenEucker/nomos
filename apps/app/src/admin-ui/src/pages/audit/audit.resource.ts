import type { AdminResourceInput } from "../../lib/resources/types";

export const auditResource: AdminResourceInput = {
  id: "audit",
  label: "Audit Log",
  labelPlural: "Audit Log",
  icon: "scroll",
  endpoints: {
    list: "/_/audit",
  },
  requiredRole: "admin",
};
