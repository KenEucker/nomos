export default {
  name: "admin",
  intents: ["admin.read", "admin.diagnostics", "webhooks.manage", "jobs.manage"],
  adminPages: [{ path: "/", label: "Dashboard" }],
  nav: [
    { path: "/", label: "Overview" },
    { path: "/users", label: "Users" },
    { path: "/api-keys", label: "API Keys" },
    { path: "/webhooks", label: "Webhooks" },
    { path: "/jobs", label: "Jobs" },
    { path: "/diagnostics", label: "Diagnostics" }
  ]
};
