import type { AdminResourceInput } from "../../lib/resources/types";

const adminBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

export const pluginsResource: AdminResourceInput = {
  id: "plugins",
  label: "Plugin",
  labelPlural: "Plugins",
  menuGroup: "Integrations",
  primaryKey: "slug",
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
      {
        key: "status",
        label: "Status",
        render: "badge",
        badgeVariants: {
          enabled: "success",
          staged: "secondary",
          installed: "warning",
          disabled: "secondary",
          broken: "destructive"
        }
      },
      {
        key: "enabled",
        label: "Enabled",
        render: "badge",
        badgeVariants: {
          true: "success",
          false: "secondary"
        }
      },
      { key: "preview", label: "Preview", render: "action", actionId: "viewPreview" },
      { key: "lastError", label: "Last Error" }
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
        id: "viewPreview",
        label: "View",
        href: (id) => `${adminBase}/plugins/${id}/preview`,
        showWhen: (record) => Boolean(record.lastPreview) || Boolean(record.lastError)
      },
      {
        id: "preview",
        label: "Preview",
        endpoint: "/plugins/{id}/preview",
        method: "POST",
        showWhen: (record) => !record.lastPreview && record.status !== "enabled"
      },
      {
        id: "enable",
        label: "Enable",
        endpoint: "/plugins/{id}/enable",
        method: "POST",
        confirm: "Enable this plugin?",
        showWhen: (record) =>
          Boolean(record.lastPreview) && (record.status === "staged" || record.status === "disabled")
      },
      {
        id: "disable",
        label: "Disable",
        endpoint: "/plugins/{id}/disable",
        method: "POST",
        confirm: "Disable this plugin?",
        showWhen: (record) => record.status === "enabled" && Boolean(record.lastPreview)
      },
      {
        id: "uninstall",
        label: "Uninstall",
        endpoint: "/plugins/{id}/uninstall",
        method: "POST",
        confirm: "Uninstall this plugin?",
        showWhen: (record) => record.status === "disabled" && Boolean(record.lastPreview)
      }
    ]
  }
};
