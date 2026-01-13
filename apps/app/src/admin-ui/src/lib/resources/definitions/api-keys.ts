import type { AdminResource } from "../types";

export const apiKeysResource: AdminResource = {
  id: "api-keys",
  label: "API Key",
  labelPlural: "API Keys",
  routeBase: "/admin/api-keys",
  primaryKey: "id",
  icon: "key",

  endpoints: {
    list: "/admin/api/api-keys",
    get: "/admin/api/api-keys/{id}",
    create: "/admin/api/api-keys",
    update: "/admin/api/api-keys/{id}",
    delete: "/admin/api/api-keys/{id}"
  },

  list: {
    columns: [
      {
        key: "name",
        label: "Name",
        sortable: true
      },
      {
        key: "prefix",
        label: "Key Prefix",
        hideOnMobile: true
      },
      {
        key: "permissions",
        label: "Permissions",
        render: "badge",
        hideOnMobile: true
      },
      {
        key: "createdAt",
        label: "Created",
        sortable: true,
        render: "datetime",
        hideOnMobile: true
      },
      {
        key: "lastUsedAt",
        label: "Last Used",
        render: "datetime"
      }
    ],
    defaultSort: {
      key: "createdAt",
      dir: "desc"
    },
    searchable: true,
    searchPlaceholder: "Search API keys...",
    pageSize: 20
  },

  form: {
    fields: [
      {
        name: "name",
        label: "Name",
        type: "text",
        required: true,
        placeholder: "e.g., Production API Key",
        help: "A descriptive name for this API key"
      },
      {
        name: "permissions",
        label: "Permissions",
        type: "relation_many",
        relationResource: "permissions",
        valueKey: "key",
        labelKey: "name",
        help: "Select which permissions this API key should have"
      },
      {
        name: "allowedHosts",
        label: "Allowed Hosts",
        type: "textarea",
        placeholder: "One host per line, e.g.:\napi.example.com\n*.example.com",
        help: "Leave blank to allow all hosts. Supports wildcards."
      }
    ]
  },

  actions: {
    create: true,
    view: true,
    update: true,
    delete: true,
    custom: [
      {
        id: "rotate",
        label: "Rotate Key",
        variant: "secondary",
        confirm: "Are you sure you want to rotate this API key? The old key will stop working immediately.",
        endpoint: "/admin/api/api-keys/{id}/rotate",
        method: "POST"
      }
    ]
  },

  requiredRole: "admin",
  dataKey: "apiKeys",
  singleDataKey: "apiKey"
};
