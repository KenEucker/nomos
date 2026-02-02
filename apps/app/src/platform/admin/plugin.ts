export default {
  name: "admin",
  intents: ["admin.read", "admin.diagnostics", "jobs.manage"],
  adminPages: [{ path: "/", label: "Dashboard" }],
  nav: [
    { path: "/", label: "Overview" },
    { path: "/users", label: "Users" },
    { path: "/api-keys", label: "API Keys" },
    { path: "/jobs", label: "Jobs" },
    { path: "/diagnostics", label: "Diagnostics" }
  ]
};
