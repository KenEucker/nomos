import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

export type PluginStateRecord = {
  id: string;
  slug: string;
  name: string;
  version: string;
  description: string | null;
  source: string;
  status: string;
  enabled: boolean;
  lastError: string | null;
  discoveredAt: Date;
  installedAt: Date | null;
  enabledAt: Date | null;
  updatedAt: Date;
  checksum: string | null;
  lastPreview: unknown | null;
  lastPreviewedAt: Date | null;
};

type PluginStateStore = {
  findMany: (args?: any) => Promise<PluginStateRecord[]>;
  findUnique: (args: any) => Promise<PluginStateRecord | null>;
  create: (args: any) => Promise<PluginStateRecord>;
  update: (args: any) => Promise<PluginStateRecord>;
};

const toIsoString = (value: Date | string | null | undefined) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
};

const toDate = (value: unknown) => (value ? new Date(value as string) : null);

const parseJson = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

const coerceRecord = (row: Record<string, any>): PluginStateRecord => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  version: row.version,
  description: row.description ?? null,
  source: row.source,
  status: row.status,
  enabled: Boolean(row.enabled),
  lastError: row.lastError ?? null,
  discoveredAt: new Date(row.discoveredAt),
  installedAt: toDate(row.installedAt),
  enabledAt: toDate(row.enabledAt),
  updatedAt: new Date(row.updatedAt),
  checksum: row.checksum ?? null,
  lastPreview: parseJson(row.lastPreview),
  lastPreviewedAt: toDate(row.lastPreviewedAt)
});

const isSqlite = () => (process.env.DATABASE_URL ?? "").startsWith("file:");

const createFallbackStore = (prisma: PrismaClient): PluginStateStore => ({
  findMany: async () => {
    const rows = (await prisma.$queryRaw`SELECT * FROM "PluginState"`) as Record<string, any>[];
    return rows.map(coerceRecord);
  },
  findUnique: async ({ where }: { where: { slug: string } }) => {
    const rows = (await prisma.$queryRaw`
      SELECT * FROM "PluginState"
      WHERE "slug" = ${where.slug}
      LIMIT 1
    `) as Record<string, any>[];
    return rows[0] ? coerceRecord(rows[0]) : null;
  },
  create: async ({ data }: { data: Partial<PluginStateRecord> }) => {
    const now = new Date();
    const id = data.id ?? randomUUID();
    const updatedAt = toIsoString(data.updatedAt ?? now);
    const discoveredAt = toIsoString(data.discoveredAt ?? now);
    const lastPreview = data.lastPreview ? JSON.stringify(data.lastPreview) : null;
    await prisma.$executeRaw`
      INSERT INTO "PluginState"
        ("id", "slug", "name", "version", "description", "source", "status", "enabled",
         "lastError", "discoveredAt", "installedAt", "enabledAt", "updatedAt",
         "checksum", "lastPreview", "lastPreviewedAt")
      VALUES
        (${id}, ${data.slug}, ${data.name}, ${data.version}, ${data.description},
         ${data.source}, ${data.status}, ${data.enabled ? 1 : 0},
         ${data.lastError}, ${discoveredAt}, ${toIsoString(data.installedAt)},
         ${toIsoString(data.enabledAt)}, ${updatedAt},
         ${data.checksum}, ${lastPreview}, ${toIsoString(data.lastPreviewedAt)})
    `;
    const created = await (prisma.$queryRaw`
      SELECT * FROM "PluginState" WHERE "slug" = ${data.slug} LIMIT 1
    ` as Promise<Record<string, any>[]>);
    return created[0] ? coerceRecord(created[0]) : coerceRecord({ ...data, id, discoveredAt, updatedAt });
  },
  update: async ({ where, data }: { where: { slug: string }; data: Partial<PluginStateRecord> }) => {
    const updatedAt = toIsoString(new Date());
    const lastPreview = data.lastPreview ? JSON.stringify(data.lastPreview) : undefined;
    await prisma.$executeRaw`
      UPDATE "PluginState"
      SET
        "name" = COALESCE(${data.name}, "name"),
        "version" = COALESCE(${data.version}, "version"),
        "description" = COALESCE(${data.description}, "description"),
        "source" = COALESCE(${data.source}, "source"),
        "status" = COALESCE(${data.status}, "status"),
        "enabled" = COALESCE(${data.enabled !== undefined ? (data.enabled ? 1 : 0) : null}, "enabled"),
        "lastError" = COALESCE(${data.lastError}, "lastError"),
        "discoveredAt" = COALESCE(${toIsoString(data.discoveredAt)}, "discoveredAt"),
        "installedAt" = COALESCE(${toIsoString(data.installedAt)}, "installedAt"),
        "enabledAt" = COALESCE(${toIsoString(data.enabledAt)}, "enabledAt"),
        "updatedAt" = ${updatedAt},
        "checksum" = COALESCE(${data.checksum}, "checksum"),
        "lastPreview" = COALESCE(${lastPreview}, "lastPreview"),
        "lastPreviewedAt" = COALESCE(${toIsoString(data.lastPreviewedAt)}, "lastPreviewedAt")
      WHERE "slug" = ${where.slug}
    `;
    const rows = (await prisma.$queryRaw`
      SELECT * FROM "PluginState" WHERE "slug" = ${where.slug} LIMIT 1
    `) as Record<string, any>[];
    return rows[0] ? coerceRecord(rows[0]) : coerceRecord({ ...data, slug: where.slug, updatedAt });
  }
});

export const getPluginStateStore = (prisma: PrismaClient): PluginStateStore => {
  const store = (prisma as unknown as { pluginState?: PluginStateStore }).pluginState;
  if (store) return store;
  if (isSqlite()) {
    return createFallbackStore(prisma);
  }
  throw new Error(
    "PluginState store not available. Run Prisma generate/migrate or enable sqlite fallback."
  );
};
