import { createResourceDefinition } from "../../lib/utils";

export const rolesResource = createResourceDefinition({
  name: "roles",
  label: "Role",
  labelPlural: "Roles",
  menu: {
    group: "Access",
    icon:
      '<svg class="flex-shrink-0 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>',
  },
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
      direction: "asc",
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
        helperText: "Unique identifier used in code. Use lowercase with underscores.",
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
  intents: {
    read: "roles.read",
    create: "roles.create",
    update: "roles.update",
    delete: "roles.delete",
  },
  dataKey: "roles",
  singleDataKey: "role",
});
