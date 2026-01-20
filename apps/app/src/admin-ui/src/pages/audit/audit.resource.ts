import { createResourceDefinition } from "../../lib/utils";

export const auditResource = createResourceDefinition({
  name: "audit",
  label: "Audit Log",
  labelPlural: "Audit Log",
  menu: {
    group: "System",
    icon:
      '<svg class="flex-shrink-0 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>',
  },
  endpoints: {
    list: "/_/audit",
  },
  dataKey: "audit",
  list: {
    searchable: true,
    searchPlaceholder: "Search audit log...",
    defaultSort: { key: "timestamp", direction: "desc" },
    columns: [
      { key: "timestamp", label: "Timestamp", render: "datetime", sortable: true },
      { key: "event", label: "Event", render: "badge" },
      { key: "userId", label: "User ID", hideOnMobile: true },
      { key: "apiKeyId", label: "API Key ID", hideOnMobile: true },
      { key: "resource", label: "Resource", hideOnMobile: true },
      { key: "action", label: "Action", hideOnMobile: true },
      { key: "ip", label: "IP", hideOnMobile: true },
      { key: "details", label: "Details", render: "json", hideOnMobile: true },
    ],
  },
  intents: {
    read: "admin.access",
  },
});
