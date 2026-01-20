import { createResourceDefinition } from "../../lib/utils";

export const sessionsResource = createResourceDefinition({
  name: "sessions",
  label: "Session",
  labelPlural: "Sessions",
  menu: {
    group: "Access",
    icon:
      '<svg class="flex-shrink-0 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>',
  },
  endpoints: {
    list: "/_/sessions",
    get: "/_/sessions/{id}",
    delete: "/_/sessions/{id}",
  },
  list: {
    columns: [
      {
        key: "id",
        label: "Session ID",
        width: "200px",
      },
      {
        key: "userName",
        label: "User",
        sortable: true,
      },
      {
        key: "userEmail",
        label: "Email",
        render: "email",
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
        key: "expiresAt",
        label: "Expires",
        sortable: true,
        render: "datetime",
      },
      {
        key: "isExpired",
        label: "Status",
        render: "badge",
        badgeVariants: {
          true: "destructive",
          false: "success",
        },
      },
    ],
    defaultSort: {
      key: "createdAt",
      direction: "desc",
    },
    searchable: true,
    searchPlaceholder: "Search by user...",
    pageSize: 20,
    customRowActions: [
      {
        id: "revoke",
        label: "Revoke",
        variant: "destructive",
        type: "method",
        endpoint: "/_/sessions/{id}",
        method: "DELETE",
        confirm: {
          title: "Revoke session?",
          body: "The user will be logged out immediately.",
        },
        toast: { success: "Session revoked" },
      },
    ],
  },
  form: {
    fields: [
      {
        name: "id",
        label: "Session ID",
        type: "text",
        readonly: true,
        showOnCreate: false,
        showOnEdit: false,
      },
      {
        name: "userName",
        label: "User",
        type: "text",
        readonly: true,
      },
      {
        name: "userEmail",
        label: "Email",
        type: "email",
        readonly: true,
      },
      {
        name: "createdAt",
        label: "Created At",
        type: "datetime",
        readonly: true,
      },
      {
        name: "expiresAt",
        label: "Expires At",
        type: "datetime",
        readonly: true,
      },
    ],
  },
  intents: {
    read: "admin.access",
    delete: "admin.access",
  },
  dataKey: "sessions",
  singleDataKey: "session",
});
