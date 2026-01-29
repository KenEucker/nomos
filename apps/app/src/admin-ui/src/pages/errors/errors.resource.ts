import { createResourceDefinition } from "../../lib/utils";

export const errorsResource = createResourceDefinition({
  name: "errors",
  label: "Errors",
  labelPlural: "Errors",
  menu: {
    group: "System",
    icon:
      '<svg class="flex-shrink-0 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
  },
  endpoints: {
    list: "/errors",
  },
  dataKey: "errors",
  list: {
    searchable: true,
    searchPlaceholder: "Search errors...",
    defaultSort: { key: "timestamp", direction: "desc" },
    columns: [
      { key: "timestamp", label: "Timestamp", render: "datetime", sortable: true },
      {
        key: "type",
        label: "Type",
        render: "badge",
        badgeVariants: {
          TypeError: "destructive",
          ReferenceError: "warning",
          SyntaxError: "warning",
          Error: "secondary",
        },
      },
      { key: "error", label: "Message" },
      { key: "source", label: "Source", hideOnMobile: true },
      { key: "routeId", label: "Route ID", hideOnMobile: true },
      { key: "stack", label: "Stack", render: "json", hideOnMobile: true },
    ],
  },
  intents: {
    read: "admin.access",
  },
});
