import type { AdminResource } from "../types";

export const webhooksResource: AdminResource = {
  id: "webhooks",
  label: "Webhooks",
  labelPlural: "Webhooks",
  routeBase: "/admin/webhooks",
  primaryKey: "id",
  icon: "webhook",
  endpoints: {
    list: "/_/webhooks",
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
