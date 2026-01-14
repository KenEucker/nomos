import type { AdminResourceInput } from "../../lib/resources/types";

export const errorsResource: AdminResourceInput = {
  id: "errors",
  label: "Errors",
  labelPlural: "Errors",
  icon: "alert",
  endpoints: {
    list: "/_/errors",
  },
  requiredRole: "admin",
};
