import { createResourceDefinition } from "../../lib/utils";

export const pluginsResource = createResourceDefinition({
  name: "plugins",
  label: "Plugin",
  labelPlural: "Plugins",
  menu: {
    group: "Integrations",
    icon:
      '<svg class="flex-shrink-0 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4a4 4 0 014 4v1h1a3 3 0 010 6h-1v1a4 4 0 01-8 0v-1H7a3 3 0 010-6h1V8a4 4 0 014-4z"/></svg>',
  },
  endpoints: {
    list: "/plugins",
  },
  dataKey: "plugins",
  list: {
    rowIdKey: "slug",
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
          broken: "destructive",
        },
      },
      {
        key: "enabled",
        label: "Enabled",
        render: "badge",
        badgeVariants: {
          true: "success",
          false: "secondary",
        },
      },
      { key: "lastError", label: "Last Error" },
    ],
    defaultSort: { key: "name", direction: "asc" },
    customRowActions: [
      {
        id: "viewPreview",
        label: "Preview",
        type: "conditionalLink",
        href: "/admin/plugins/{slug}/preview",
        checkKey: "lastPreview",
        toastIfMissing: "No preview has been generated yet.",
        showWhen: { key: "status", in: ["staged", "disabled"] },
      },
      {
        id: "viewWhenBroken",
        label: "View",
        type: "link",
        href: "/admin/plugins/{slug}/preview",
        showWhen: { key: "status", equals: "broken" },
      },
      {
        id: "preview",
        label: "Generate Preview",
        type: "method",
        endpoint: "/plugins/{slug}/preview",
        method: "POST",
        toast: { success: "Preview generated successfully" },
        after: "navigate",
        href: "/admin/plugins/{slug}/preview",
        showWhen: { key: "lastPreview", falsy: true },
      },
      {
        id: "enable",
        label: "Enable",
        type: "method",
        endpoint: "/plugins/{slug}/enable",
        method: "POST",
        confirm: {
          title: "Enable this plugin?",
        },
        toast: { success: "Plugin enabled" },
        after: "refresh",
        showWhen: { key: "status", in: ["staged", "disabled", "broken"] },
      },
      {
        id: "disable",
        label: "Disable",
        type: "method",
        endpoint: "/plugins/{slug}/disable",
        method: "POST",
        confirm: {
          title: "Disable this plugin?",
        },
        toast: { success: "Plugin disabled" },
        after: "refresh",
        showWhen: { key: "enabled", equals: true },
      },
      {
        id: "uninstall",
        label: "Uninstall",
        type: "method",
        endpoint: "/plugins/{slug}/uninstall",
        method: "POST",
        confirm: {
          title: "Uninstall this plugin?",
        },
        toast: { success: "Plugin uninstall requested" },
      },
    ],
  },
  intents: {
    read: "admin.access",
  },
});
