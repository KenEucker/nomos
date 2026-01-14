import type { AdminResource } from "../types";

export const loginResource: AdminResource = {
  id: "login",
  label: "Login",
  labelPlural: "Login",
  routeBase: "/admin/login",
  primaryKey: "id",
  endpoints: {
    list: "/auth/login",
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
};
