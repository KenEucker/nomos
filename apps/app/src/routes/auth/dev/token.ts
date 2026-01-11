import { z } from "zod";
import type { Ctx } from "../../../platform/ctx.js";
import { signJwt } from "../../../platform/auth/jwt.js";

const DEFAULT_ADMIN_PERMISSIONS = [
  "admin.read",
  "admin.diagnostics",
  "auth.manage",
  "webhooks.manage",
  "jobs.manage"
];
const DEFAULT_DEV_PERMISSIONS = ["users.read", "users.create", "users.update", "users.delete"];

export const config = {
  auth: "none",
  summary: "Issue a development JWT for Swagger testing",
  description:
    "Development-only endpoint for issuing a JWT when DEV_AUTH_SECRET is provided.",
  tags: ["auth"],
  validate: {
    body: z.object({
      secret: z.string().min(1)
    })
  }
};

export async function post(ctx: Ctx) {
  const env = ctx.services.env;
  if (env.NODE_ENV !== "development") {
    return ctx.error(404, "not_found");
  }
  if (!env.DEV_AUTH_SECRET) {
    return ctx.error(403, "dev_auth_disabled");
  }
  const secret = ctx.body?.secret;
  if (!secret || secret !== env.DEV_AUTH_SECRET) {
    return ctx.error(403, "invalid_dev_auth_secret");
  }

  let user = Array.from(ctx.db.users.values()).find((entry: any) =>
    (entry.roles ?? []).includes("admin")
  );
  if (!user) {
    user = {
      id: "dev-admin",
      email: "dev-admin@local",
      name: "Dev Admin",
      roles: ["admin"],
      permissions: [...DEFAULT_DEV_PERMISSIONS]
    };
    ctx.db.users.set(user.id, user);
  }
  if (user.permissions) {
    user.permissions = Array.from(new Set([...user.permissions, ...DEFAULT_DEV_PERMISSIONS]));
  } else {
    user.permissions = [...DEFAULT_DEV_PERMISSIONS];
  }
  if (!ctx.db.roles.has("admin")) {
    ctx.db.roles.set("admin", DEFAULT_ADMIN_PERMISSIONS);
  }

  const now = Math.floor(Date.now() / 1000);
  const token = signJwt(
    {
      sub: user.id,
      roles: user.roles ?? [],
      iat: now,
      exp: now + 60 * 60
    },
    env.JWT_SECRET
  );

  return {
    token,
    tokenType: "Bearer",
    expiresIn: 60 * 60,
    user: {
      id: user.id,
      email: user.email,
      roles: user.roles ?? []
    }
  };
}
