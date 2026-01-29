import type { PluginPlan, PreviewContext } from "../../platform/pluginManager/types";
import { createUsersService } from "./services/users.service";
import { resources } from "./admin/resources";
import auditListener from "./listeners/audit.listener";
import { registerUserHooks } from "./events/users.events";

export default {
  slug: "users",
  name: "users",
  version: "1.0.0",
  description: "Core user management plugin with routes, admin UI, and jobs.",
  intents: [
    "users.read",
    "users.create",
    "users.update",
    "users.delete",
    "roles.manage",
    "auth.manage"
  ],
  services: {
    users: (db: any, hooks: any, events: any) => createUsersService(db, hooks, events)
  },
  adminResources: resources,
  nav: [{ path: "/users", label: "Users" }],
  listeners: [auditListener],
  // Jobs are now discovered from plugins/<name>/jobs/**/*.ts via filesystem discovery
  // See: plugins/users/jobs/exampleUserSync.job.ts
  events: ["users.created", "users.updated", "users.deleted", "users.beforeCreate", "users.afterCreate"],
  setup: (hooks: any, events: any) => registerUserHooks(hooks, events),
  preview: (ctx: PreviewContext): PluginPlan => {
    ctx.declare.permission("users.read");
    ctx.declare.permission("users.create");
    ctx.declare.permission("users.update");
    ctx.declare.permission("users.delete");
    ctx.declare.permission("roles.manage");
    ctx.declare.permission("auth.manage");

    ctx.declare.route({ method: "GET", path: "/users", description: "List users" });
    ctx.declare.route({ method: "POST", path: "/users", description: "Create user" });
    ctx.declare.route({ method: "GET", path: "/users/:id", description: "Get user" });
    ctx.declare.route({ method: "PATCH", path: "/users/:id", description: "Update user" });
    ctx.declare.route({ method: "DELETE", path: "/users/:id", description: "Delete user" });

    ctx.declare.adminPage({
      path: "/users",
      title: "Users",
      description: "Manage application users."
    });
    ctx.declare.adminMenu({ label: "Users", path: "/users" });

    return {
      slug: "users",
      version: "1.0.0",
      summary: "Adds user management routes, admin resources, and audit hooks.",
      warnings: ctx.env.nodeEnv === "production" ? [] : ["Demo data is enabled in development."]
    };
  }
};
