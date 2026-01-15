import type { AdminResourceInput } from "../../lib/resources/types";

export const webhooksResource: AdminResourceInput = {
  id: "webhooks",
  label: "Webhooks",
  labelPlural: "Webhooks",
  menuGroup: "Integrations",
  icon:
    '<svg class="flex-shrink-0 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>',
  endpoints: {
    list: "/_/webhooks",
    create: "/_/webhooks",
  },
  dataKey: "destinations",
  list: {
    searchable: true,
    searchPlaceholder: "Search webhooks...",
    columns: [
      { key: "url", label: "URL" },
      { key: "events", label: "Events", render: "badge" },
      { key: "secret", label: "Secret", hideOnMobile: true },
      { key: "retryPolicy.attempts", label: "Retry Attempts", hideOnMobile: true },
      { key: "retryPolicy.delayMs", label: "Retry Delay (ms)", hideOnMobile: true },
      { key: "createdAt", label: "Created", render: "datetime", hideOnMobile: true },
    ],
  },
  form: {
    fields: [
      { name: "url", label: "URL", type: "text", required: true },
      { name: "events", label: "Events", type: "json" },
      { name: "secret", label: "Secret", type: "text" },
      { name: "retryPolicy", label: "Retry Policy", type: "json" },
    ],
  },
  actions: {
    view: false,
    update: false,
    delete: false,
  },
  requiredRole: "admin",
};
