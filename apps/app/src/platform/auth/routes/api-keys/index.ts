import { z } from "zod";
import type { Ctx } from "../../../ctx";

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
  summary: "Manage API keys",
};

export const getConfig = {
  auth: "required",
  intent: "apiKeys.list",
  tags: ["admin"],
  summary: "List API keys",
};

export const get = async (ctx: Ctx) => {
  const rows = await ctx.prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
  });
  const apiKeys = rows.map((r) => sanitizeApiKeyEntry(r));
  return ctx.json({ apiKeys });
};

export const postConfig = {
  auth: "required",
  intent: "auth.manage",
  validate: {
    body: z.object({
      name: z.string().optional(),
      permissions: z.array(z.string()).optional(),
      allowedHosts: z.array(z.string()).optional(),
    }).partial(),
  },
};

export const post = async (ctx: Ctx) => {
  const entry = await ctx.services.auth.createApiKey(ctx.body ?? {});
  return ctx.json(entry, 201);
};

