import type { AdminResourceInput } from "../../lib/resources/types";

export const usersResource: AdminResourceInput = {
  id: "users",
  label: "User",
  labelPlural: "Users",
  icon: "users",
  endpoints: {
    list: "/users",
    get: "/users/{id}",
    create: "/users",
    update: "/users/{id}",
    delete: "/users/{id}",
  },
  list: {
    columns: [
      {
        key: "name",
        label: "Name",
        sortable: true,
      },
      {
        key: "email",
        label: "Email",
        sortable: true,
        render: "email",
        hideOnMobile: true,
      },
      {
        key: "roles",
        label: "Roles",
        render: "badge",
      },
      {
        key: "createdAt",
        label: "Created",
        sortable: true,
        render: "datetime",
        hideOnMobile: true,
      },
    ],
    defaultSort: {
      key: "createdAt",
      dir: "desc",
    },
    searchable: true,
    searchPlaceholder: "Search users...",
    pageSize: 20,
  },
  form: {
    fields: [
      {
        name: "name",
        label: "Name",
        type: "text",
        required: true,
        placeholder: "Enter full name",
      },
      {
        name: "email",
        label: "Email",
        type: "email",
        required: true,
        placeholder: "user@example.com",
      },
      {
        name: "password",
        label: "Password",
        type: "password",
        required: true,
        showOnCreate: true,
        showOnEdit: true,
        showOnView: false,
        placeholder: "Minimum 6 characters",
        help: "Leave blank to keep existing password (edit only)",
      },
      {
        name: "roles",
        label: "Roles",
        type: "relation_many",
        relationResource: "roles",
        valueKey: "key",
        labelKey: "name",
        optionsEndpoint: "/roles",
        showOnCreate: true,
        showOnEdit: true,
        showOnView: true,
      },
    ],
  },
  requiredRole: "admin",
  dataKey: "users",
  singleDataKey: "user",
};
