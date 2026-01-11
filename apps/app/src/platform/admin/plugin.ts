import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  name: "admin",
  permissions: ["admin.read", "admin.diagnostics", "webhooks.manage", "jobs.manage"],
  routes: [
    {
      baseDir: path.join(__dirname, "routes"),
      owner: "admin"
    }
  ],
  adminPages: [{ path: "/admin", label: "Dashboard" }],
  nav: [
    { path: "/admin", label: "Overview" },
    { path: "/admin/users", label: "Users" },
    { path: "/admin/api-keys", label: "API Keys" },
    { path: "/admin/webhooks", label: "Webhooks" },
    { path: "/admin/jobs", label: "Jobs" },
    { path: "/admin/diagnostics", label: "Diagnostics" }
  ]
};
