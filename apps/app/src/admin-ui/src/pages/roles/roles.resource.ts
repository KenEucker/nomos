import type { AdminResourceInput } from "../../lib/resources/types";

export const rolesResource: AdminResourceInput = {
  id: "roles",
  label: "Role",
  labelPlural: "Roles",
  icon: "shield",
  endpoints: {
    list: "/roles",
    get: "/roles/{id}",
    create: "/roles",
    update: "/roles/{id}",
    delete: "/roles/{id}",
  },
  list: {
    columns: [
      {
        key: "key",
        label: "Key",
        sortable: true,
      },
      {
        key: "name",
        label: "Name",
        sortable: true,
      },
      {
        key: "userCount",
        label: "Users",
        render: "text",
        hideOnMobile: true,
      },
    ],
    defaultSort: {
      key: "key",
      dir: "asc",
    },
    searchable: true,
    searchPlaceholder: "Search roles...",
    pageSize: 20,
  },
  form: {
    fields: [
      {
        name: "key",
        label: "Key",
        type: "text",
        required: true,
        placeholder: "e.g., admin, editor, viewer",
        help: "Unique identifier used in code. Use lowercase with underscores.",
        showOnEdit: false,
      },
      {
        name: "name",
        label: "Display Name",
        type: "text",
        required: true,
        placeholder: "e.g., Administrator",
      },
    ],
  },
  requiredRole: "admin",
  dataKey: "roles",
  singleDataKey: "role",
};
