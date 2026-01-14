import type { AdminResourceInput } from "../lib/resources/types";

export const dashboardResource: AdminResourceInput = {
  id: "dashboard",
  label: "Dashboard",
  labelPlural: "Dashboard",
  routeBase: "/admin",
  icon: "dashboard",
  endpoints: {
    list: "/_/dashboard",
  },
  requiredRole: "admin",
};
