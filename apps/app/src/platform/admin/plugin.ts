import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  name: "admin",
  intents: ["admin.read", "admin.diagnostics", "webhooks.manage", "jobs.manage"],
  routes: [
    {
      baseDir: path.join(__dirname, "routes"),
      owner: "admin"
    }
  ],
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
