import type { AdminResource } from "../types";

export const docsResource: AdminResource = {
  id: "docs",
  label: "API Docs",
  labelPlural: "API Docs",
  routeBase: "/admin/docs",
  primaryKey: "id",
  icon: "book",
  endpoints: {
    list: "/openapi.json",
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
