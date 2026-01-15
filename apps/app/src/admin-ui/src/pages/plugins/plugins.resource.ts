import type { AdminResourceInput } from "../../lib/resources/types";

export const pluginsResource: AdminResourceInput = {
  id: "plugins",
  label: "Plugin",
  labelPlural: "Plugins",
  menuGroup: "System",
  icon:
    '<svg class="flex-shrink-0 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4a4 4 0 014 4v1h1a3 3 0 010 6h-1v1a4 4 0 01-8 0v-1H7a3 3 0 010-6h1V8a4 4 0 014-4z"/></svg>',
  endpoints: {
    list: "/plugins"
  },
  dataKey: "plugins",
  requiredRole: "admin",
  list: {
    columns: [
      { key: "slug", label: "Slug", sortable: true },
      { key: "name", label: "Name", sortable: true },
      { key: "version", label: "Version" },
      { key: "status", label: "Status", render: "badge" },
      { key: "enabled", label: "Enabled", render: "boolean" },
      { key: "missing", label: "Missing", render: "boolean" },
      { key: "lastError", label: "Last Error" },
      { key: "lastPreview", label: "Last Preview", render: "json" }
    ],
    defaultSort: { key: "name", dir: "asc" }
  },
  actions: {
    create: false,
    view: false,
    update: false,
    delete: false,
    custom: [
      {
        id: "install",
        label: "Install",
        endpoint: "/plugins/{id}/install",
        method: "POST",
        confirm: "Install this plugin?"
      },
      {
        id: "preview",
        label: "Preview",
        endpoint: "/plugins/{id}/preview",
        method: "POST"
      },
      {
        id: "enable",
        label: "Enable",
        endpoint: "/plugins/{id}/enable",
        method: "POST",
        confirm: "Enable this plugin?"
      },
      {
        id: "disable",
        label: "Disable",
        endpoint: "/plugins/{id}/disable",
        method: "POST",
        confirm: "Disable this plugin?"
      },
      {
        id: "uninstall",
        label: "Uninstall",
        endpoint: "/plugins/{id}/uninstall",
        method: "POST",
        confirm: "Uninstall this plugin?"
      }
    ]
  }
};
