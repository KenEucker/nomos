import { createResourceDefinition } from "../../lib/utils";

export const apiKeysResource = createResourceDefinition({
  name: "api-keys",
  label: "API Key",
  labelPlural: "API Keys",
  menu: {
    group: "Access",
    icon:
      '<svg class="flex-shrink-0 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>',
  },
  endpoints: {
    list: "/api-keys",
    get: "/api-keys/{id}",
    create: "/api-keys",
    update: "/api-keys/{id}",
    delete: "/api-keys/{id}",
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
      direction: "desc",
    },
    searchable: true,
    searchPlaceholder: "Search API keys...",
    pageSize: 20,
    customRowActions: [
      {
        id: "rotate",
        label: "Rotate",
        variant: "secondary",
        type: "method",
        endpoint: "/api-keys/{id}",
        method: "PATCH",
        payload: { action: "rotate" },
        confirm: {
          title: "Rotate API key?",
          body: "The old key will stop working immediately.",
        },
        toast: { success: "API key rotated" },
      },
    ],
  },
  form: {
    fields: [
      {
        name: "name",
        label: "Name",
        type: "text",
        required: true,
        placeholder: "e.g., Production API Key",
        helperText: "A descriptive name for this API key.",
      },
      {
        name: "permissions",
        label: "Permissions",
        type: "multiselect",
        optionsEndpoint: "/permissions",
        optionsKey: "permissions",
        valueKey: "key",
        labelKey: "name",
        helperText: "Select which permissions this API key should have.",
      },
      {
        name: "allowedHosts",
        label: "Allowed Hosts",
        type: "textarea",
        placeholder: "One host per line, e.g.:\napi.example.com\n*.example.com",
        helperText: "Leave blank to allow all hosts. Supports wildcards.",
        transform: "lines",
      },
    ],
  },
  intents: {
    read: "admin.access",
    create: "admin.access",
    update: "admin.access",
    delete: "admin.access",
  },
  dataKey: "apiKeys",
  singleDataKey: "apiKey",
});
