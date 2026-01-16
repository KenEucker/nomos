import type { AdminResourceInput } from "../../../../admin-ui/src/lib/resources/types";

export const sdkResource: AdminResourceInput = {
  id: "sdk",
  label: "SDK",
  labelPlural: "SDK",
  menuGroup: "System",
  icon:
    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>',
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
