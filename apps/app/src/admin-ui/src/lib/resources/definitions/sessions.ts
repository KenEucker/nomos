import type { AdminResource } from "../types";

export const sessionsResource: AdminResource = {
  id: "sessions",
  label: "Session",
  labelPlural: "Sessions",
  routeBase: "/admin/sessions",
  primaryKey: "id",
  icon: "key",

  endpoints: {
    list: "/admin/sessions",
    get: "/admin/sessions/{id}",
    create: "", // Sessions are not created via admin
    update: "", // Sessions are not updated
    delete: "/admin/sessions/{id}"
  },

  list: {
    columns: [
      {
        key: "id",
        label: "Session ID",
        width: "200px"
      },
      {
        key: "userName",
        label: "User",
        sortable: true
      },
      {
        key: "userEmail",
        label: "Email",
        render: "email",
        hideOnMobile: true
      },
      {
        key: "createdAt",
        label: "Created",
        sortable: true,
        render: "datetime",
        hideOnMobile: true
      },
      {
        key: "expiresAt",
        label: "Expires",
        sortable: true,
        render: "datetime"
      },
      {
        key: "isExpired",
        label: "Status",
        render: "badge",
        badgeVariants: {
          "true": "destructive",
          "false": "success"
        }
      }
    ],
    defaultSort: {
      key: "createdAt",
      dir: "desc"
    },
    searchable: true,
    searchPlaceholder: "Search by user...",
    pageSize: 20
  },

  form: {
    fields: [
      {
        name: "id",
        label: "Session ID",
        type: "text",
        readonly: true,
        showOnCreate: false,
        showOnEdit: false
      },
      {
        name: "userName",
        label: "User",
        type: "text",
        readonly: true
      },
      {
        name: "userEmail",
        label: "Email",
        type: "email",
        readonly: true
      },
      {
        name: "createdAt",
        label: "Created At",
        type: "datetime",
        readonly: true
      },
      {
        name: "expiresAt",
        label: "Expires At",
        type: "datetime",
        readonly: true
      }
    ]
  },

  actions: {
    create: false, // Sessions are created via login
    view: true,
    update: false, // Sessions cannot be edited
    delete: true, // Allow revoking sessions
    custom: [
      {
        id: "revoke",
        label: "Revoke Session",
        variant: "destructive",
        confirm: "Are you sure you want to revoke this session? The user will be logged out.",
        endpoint: "/admin/sessions/{id}",
        method: "DELETE"
      }
    ]
  },

  requiredRole: "admin",
  dataKey: "sessions",
  singleDataKey: "session"
};
