import type { AdminResourceInput } from "../../lib/resources/types";

export const routesResource: AdminResourceInput = {
  id: "routes",
  label: "Routes",
  labelPlural: "Routes",
  icon: "git-branch",
  endpoints: {
    list: "/_/routes",
  },
  requiredRole: "admin",
};
