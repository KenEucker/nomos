import type { AdminResource } from "../types";

export const auditResource: AdminResource = {
  id: "audit",
  label: "Audit Log",
  labelPlural: "Audit Log",
  routeBase: "/admin/audit",
  primaryKey: "id",
  icon: "scroll",
  endpoints: {
    list: "/_/audit",
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
