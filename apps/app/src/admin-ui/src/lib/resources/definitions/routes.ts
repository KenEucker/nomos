import type { AdminResource } from "../types";

export const routesResource: AdminResource = {
  id: "routes",
  label: "Routes",
  labelPlural: "Routes",
  routeBase: "/admin/routes",
  primaryKey: "id",
  icon: "git-branch",
  endpoints: {
    list: "/_/routes",
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
