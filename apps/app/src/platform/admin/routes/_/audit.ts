export const config = {
  auth: "required",
  permissions: ["admin.read"],
  tags: ["admin"],
  summary: "Audit log"
};

import type { Ctx } from "../../../ctx";

export const get = async (ctx: Ctx) => {
  const search = typeof ctx.query.search === "string" ? ctx.query.search.trim().toLowerCase() : "";
  let audit = ctx.db.auditLog.slice(-200);

  if (search) {
    audit = audit.filter((entry) => {
      const fields = [
        entry.event,
        entry.userId,
        entry.apiKeyId,
        entry.resource,
        entry.action,
        entry.ip,
        JSON.stringify(entry.details ?? {})
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return fields.includes(search);
    });
  }

  return ctx.json({ audit }, 200, { total: audit.length });
};
