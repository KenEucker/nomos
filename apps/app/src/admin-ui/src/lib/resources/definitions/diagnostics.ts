import type { AdminResource } from "../types";

export const diagnosticsResource: AdminResource = {
  id: "diagnostics",
  label: "Diagnostics",
  labelPlural: "Diagnostics",
  routeBase: "/admin/diagnostics",
  primaryKey: "id",
  icon: "activity",
  endpoints: {
    list: "/_/diagnostics",
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
