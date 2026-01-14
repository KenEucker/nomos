import type { AdminResourceInput } from "../../lib/resources/types";

export const apiKeysResource: AdminResourceInput = {
  id: "api-keys",
  label: "API Key",
  labelPlural: "API Keys",
  icon: "key",
  endpoints: {
    list: "/_/api-keys",
    get: "/_/api-keys/{id}",
    create: "/_/api-keys",
    update: "/_/api-keys/{id}",
    delete: "/_/api-keys/{id}",
  },
  list: {
    columns: [
      {
        key: "name",
        label: "Name",
        sortable: true,
      },
      {
        key: "prefix",
        label: "Key Prefix",
        hideOnMobile: true,
      },
      {
        key: "permissions",
        label: "Permissions",
        render: "badge",
        hideOnMobile: true,
      },
      {
        key: "createdAt",
        label: "Created",
        sortable: true,
        render: "datetime",
        hideOnMobile: true,
      },
      {
        key: "lastUsedAt",
        label: "Last Used",
        render: "datetime",
      },
    ],
    defaultSort: {
      key: "createdAt",
      dir: "desc",
    },
    searchable: true,
    searchPlaceholder: "Search API keys...",
    pageSize: 20,
  },
  form: {
    fields: [
      {
        name: "name",
        label: "Name",
        type: "text",
        required: true,
        placeholder: "e.g., Production API Key",
        help: "A descriptive name for this API key",
      },
      {
        name: "permissions",
        label: "Permissions",
        type: "relation_many",
        relationResource: "permissions",
        optionsEndpoint: "/_/permissions",
        valueKey: "key",
        labelKey: "name",
        help: "Select which permissions this API key should have",
      },
      {
        name: "allowedHosts",
        label: "Allowed Hosts",
        type: "textarea",
        placeholder: "One host per line, e.g.:\napi.example.com\n*.example.com",
        help: "Leave blank to allow all hosts. Supports wildcards.",
        submitTransform: (value) =>
          typeof value === "string"
            ? value
                .split(/[\n,]+/)
                .map((entry) => entry.trim())
                .filter(Boolean)
            : value,
      },
    ],
  },
  actions: {
    custom: [
      {
        id: "rotate",
        label: "Rotate Key",
        variant: "secondary",
        confirm: "Are you sure you want to rotate this API key? The old key will stop working immediately.",
        endpoint: "/_/api-keys/{id}/rotate",
        method: "POST",
      },
    ],
  },
  requiredRole: "admin",
  dataKey: "apiKeys",
  singleDataKey: "apiKey",
};
