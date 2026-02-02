import type { Ctx } from "../../../ctx";

export const config = {
  auth: "required",
  intent: "permissions.read",
  tags: ["admin"],
  summary: "List available permissions"
};

/** Canonical list of platform permission keys (must match authz seeder). Returned so the UI always has the full list. */
const PLATFORM_PERMISSION_KEYS: string[] = [
  "admin.access",
  "admin.read",
  "admin.diagnostics",
  "roles.list",
  "roles.read",
  "roles.create",
  "roles.update",
  "roles.delete",
  "roles.manage",
  "permissions.read",
  "subjects.read",
  "subjects.update",
  "apiKeys.list",
  "apiKeys.read",
  "apiKeys.create",
  "apiKeys.update",
  "apiKeys.delete",
  "debug.decisions.view",
  "jobs.manage",
  "auth.manage",
  "plugins.manage",
  "sdk.read",
  "sdk.write",
  "users.list",
  "users.read",
  "users.create",
  "users.update",
  "users.delete",
];

const formatName = (permission: string) => {
  return permission
    .split(".")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
};

export const get = async (ctx: Ctx) => {
  const rows = await ctx.prisma.permission.findMany({
    orderBy: { key: "asc" },
  });
  const dbByKey = new Map(rows.map((p) => [p.key, p]));

  // Merge canonical platform keys with DB so the list is complete even if DB is out of sync
  const keys = new Set<string>([...PLATFORM_PERMISSION_KEYS, ...rows.map((p) => p.key)]);
  const permissions = Array.from(keys)
    .sort()
    .map((key) => {
      const row = dbByKey.get(key);
      return {
        key,
        name: row?.description ?? formatName(key),
      };
    });
  return ctx.json({ permissions });
};
