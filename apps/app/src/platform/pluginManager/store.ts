import type { PrismaClient } from "@prisma/client";

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

export const getPluginStateStore = (prisma: PrismaClient): PluginStateStore => {
  return (prisma as unknown as { pluginState: PluginStateStore }).pluginState;
};
