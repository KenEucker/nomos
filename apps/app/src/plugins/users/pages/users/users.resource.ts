import type { AdminResourceInput } from "../../../../admin-ui/src/lib/resources/types";

export const usersResource: AdminResourceInput = {
  id: "users",
  label: "User",
  labelPlural: "Users",
  menuGroup: "Access",
  menuOrder: 1,
  icon:
    '<svg class="flex-shrink-0 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>',
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
