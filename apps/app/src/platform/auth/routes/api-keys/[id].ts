import { z } from "zod";
import type { Ctx } from "../../../ctx";

const paramsId = z.object({ id: z.string() });

function sanitizeApiKeyEntry(record: {
  id: string;
  name: string;
  keyHash?: string;
  permissions?: unknown;
  allowedHosts?: string | null;
  revokedAt?: Date | null;
  createdAt: Date;
  lastUsedAt?: Date | null;
}) {
  const permissions = Array.isArray(record.permissions)
    ? record.permissions
    : record.permissions
      ? JSON.parse(String(record.permissions))
      : [];
  const allowedHosts =
    typeof record.allowedHosts === "string" && record.allowedHosts
      ? JSON.parse(record.allowedHosts)
      : [];
  return {
    id: record.id,
    name: record.name,
    prefix: "••••••••",
    permissions,
    allowedHosts,
    revoked: Boolean(record.revokedAt),
    createdAt:
      record.createdAt instanceof Date
        ? record.createdAt.toISOString()
        : record.createdAt,
    lastUsedAt: record.lastUsedAt ?? null,
  };
}

export const config = {
  auth: "required",
  intent: "auth.manage",
  tags: ["admin"],
  summary: "API key by id",
  validate: { params: paramsId },
};

export const getConfig = {
  auth: "required",
  intent: "apiKeys.read",
  tags: ["admin"],
  summary: "Get API key",
  validate: { params: paramsId },
};

export const get = async (ctx: Ctx) => {
  const { id } = ctx.params;
  const record = await ctx.prisma.apiKey.findUnique({ where: { id } });
  if (!record) {
    return ctx.json({ error: "not_found" }, 404);
  }
  const apiKey = sanitizeApiKeyEntry(record);
  return ctx.json({ apiKey });
};

export const delConfig = {
  auth: "required",
  intent: "apiKeys.delete",
  tags: ["admin"],
  summary: "Delete API key",
  validate: { params: paramsId },
};

export const del = async (ctx: Ctx) => {
  const { id } = ctx.params;
  try {
    await ctx.prisma.apiKey.delete({ where: { id } });
    return ctx.json({ deleted: true });
  } catch {
    return ctx.json({ error: "not_found" }, 404);
  }
};

export const patchConfig = {
  auth: "required",
  intent: "auth.manage",
  tags: ["admin"],
  summary: "Update API key (rotate/revoke)",
  validate: {
    params: paramsId,
    body: z.object({
      action: z.enum(["rotate", "revoke"]).optional(),
    }),
  },
};

export const patch = async (ctx: Ctx) => {
  const { id } = ctx.params;
  const action = ctx.body?.action;
  if (action === "rotate") {
    const entry = await ctx.services.auth.rotateApiKey(id);
    return ctx.json(entry ?? { error: "not_found" }, entry ? 200 : 404);
  }
  if (action === "revoke") {
    const entry = await ctx.services.auth.revokeApiKey(id);
    return ctx.json(entry ?? { error: "not_found" }, entry ? 200 : 404);
  }
  return ctx.error(400, "invalid_request", "Invalid action");
};
