import { createResourceDefinition } from "../../lib/utils";

export const routesResource = createResourceDefinition({
  name: "routes",
  label: "Routes",
  labelPlural: "Routes",
  menu: {
    group: "System",
    icon:
      '<svg class="flex-shrink-0 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>',
  },
  endpoints: {
    list: "/_/routes",
  },
  dataKey: "routes",
  list: {
    searchable: true,
    searchPlaceholder: "Search routes...",
    columns: [
      {
        key: "method",
        label: "Method",
        render: "badge",
        badgeVariants: {
          GET: "success",
          POST: "secondary",
          PUT: "warning",
          PATCH: "warning",
          DELETE: "destructive",
        },
      },
      { key: "path", label: "Path" },
      { key: "id", label: "ID", hideOnMobile: true },
      { key: "config.summary", label: "Summary", hideOnMobile: true },
      { key: "config.auth", label: "Auth", hideOnMobile: true },
    ],
  },
  intents: {
    read: "admin.access",
  },
});
