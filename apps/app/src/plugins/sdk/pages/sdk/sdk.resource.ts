import type { AdminResourceInput } from "../../../../admin-ui/src/lib/resources/types";

export const sdkResource: AdminResourceInput = {
  id: "sdk",
  label: "SDK",
  labelPlural: "SDK",
  menuGroup: "System",
  icon:
    '<svg class="flex-shrink-0 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>',
  endpoints: {
    list: "/sdk/status"
  },
  dataKey: "sdk",
  requiredRole: "admin",
  actions: {
    create: false,
    view: false,
    update: false,
    delete: false,
    custom: [
      {
        id: "invalidate",
        label: "Invalidate Cache",
        variant: "outline",
        confirm: "Invalidate the SDK cache? Clients will need to refetch the SDK.",
        endpoint: "/sdk/invalidate",
        method: "POST"
      },
      {
        id: "regenerate",
        label: "Regenerate SDK",
        variant: "secondary",
        confirm: "Regenerate the SDK artifacts now?",
        endpoint: "/sdk/regenerate",
        method: "POST"
      }
    ]
  },
  list: {
    columns: [
      { key: "apiRevision", label: "API Revision" },
      { key: "apiVersion", label: "API Version" },
      { key: "platformVersion", label: "Platform Version" },
      { key: "generatedAt", label: "Generated", render: "datetime" },
      { key: "artifacts", label: "Artifacts", render: "json", hideOnMobile: true }
    ],
    searchable: false,
    pageSize: 1
  }
};
