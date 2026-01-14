import type { AdminResource } from "../types";

export const dashboardResource: AdminResource = {
  id: "dashboard",
  label: "Dashboard",
  labelPlural: "Dashboard",
  routeBase: "/admin",
  primaryKey: "id",
  icon: "dashboard",
  endpoints: {
    list: "/_/dashboard",
    get: "",
    create: "",
    update: "",
    delete: "",
  },
  list: {
    columns: [],
  },
  form: {
    fields: [],
  },
  actions: {
    create: false,
    view: false,
    update: false,
    delete: false,
  },
  requiredRole: "admin",
};
