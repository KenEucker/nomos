import path from "node:path";
import { fileURLToPath } from "node:url";
import { createUsersService } from "./services/users.service.js";
import { resources } from "./admin/resources.js";
import auditListener from "./listeners/audit.listener.js";
import { registerUserHooks } from "./events/users.events.js";
import exampleJob from "./jobs/exampleUserSync.job.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  name: "users",
  permissions: [
    "users.read",
    "users.create",
    "users.update",
    "users.delete",
    "roles.manage",
    "auth.manage"
  ],
  routes: [{ baseDir: path.join(__dirname, "routes"), owner: "users" }],
  services: {
    users: (db: any, hooks: any, events: any) => createUsersService(db, hooks, events)
  },
  adminResources: resources,
  nav: [{ path: "/users", label: "Users" }],
  listeners: [auditListener],
  jobs: [exampleJob],
  events: ["users.created", "users.updated", "users.deleted", "users.beforeCreate", "users.afterCreate"],
  setup: (hooks: any, events: any) => registerUserHooks(hooks, events)
};
