export const resources = [
  {
    name: "users",
    label: "Users",
    route: "/admin/users",
    fields: [
      { name: "id", type: "id" },
      { name: "name", type: "text", required: true },
      { name: "email", type: "email", required: true },
      { name: "roles", type: "select", options: ["admin", "viewer"] }
    ]
  },
  {
    name: "roles",
    label: "Roles",
    route: "/admin/roles",
    fields: [
      { name: "name", type: "text", required: true },
      { name: "permissions", type: "select", options: [] }
    ]
  },
  {
    name: "apiKeys",
    label: "API Keys",
    route: "/admin/api-keys",
    fields: [
      { name: "name", type: "text" },
      { name: "permissions", type: "select", options: [] },
      { name: "allowedHosts", type: "text" }
    ]
  }
];
