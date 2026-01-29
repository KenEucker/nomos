import type { Ctx } from "../../../ctx";

export const config = {
  auth: "required",
  intent: "permissions.read",
  tags: ["admin"],
  summary: "List available permissions"
};

const formatName = (permission: string) => {
  return permission
    .split(".")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
};

export const get = async (ctx: Ctx) => {
  const permissions = Array.from(ctx.db.permissions)
    .sort()
    .map((permission) => ({
      key: permission,
      name: formatName(permission)
    }));
  return ctx.json({ permissions });
};
