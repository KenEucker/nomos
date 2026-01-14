import type { AdminResourceInput } from "../../lib/resources/types";

export const apiKeysResource: AdminResourceInput = {
  id: "api-keys",
  label: "API Key",
  labelPlural: "API Keys",
  icon:
    '<svg class="flex-shrink-0 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>',
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
