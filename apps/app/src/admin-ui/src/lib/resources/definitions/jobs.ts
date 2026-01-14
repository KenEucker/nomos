import type { AdminResource } from "../types";

export const jobsResource: AdminResource = {
  id: "jobs",
  label: "Jobs",
  labelPlural: "Jobs",
  routeBase: "/admin/jobs",
  primaryKey: "id",
  icon: "clock",
  endpoints: {
    list: "/_/jobs",
    get: "/_/jobs/{id}",
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
