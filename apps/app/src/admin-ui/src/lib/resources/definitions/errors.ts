import type { AdminResource } from "../types";

export const errorsResource: AdminResource = {
  id: "errors",
  label: "Errors",
  labelPlural: "Errors",
  routeBase: "/admin/errors",
  primaryKey: "id",
  icon: "alert",
  endpoints: {
    list: "/_/errors",
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
