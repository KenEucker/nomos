-- CreateTable
CREATE TABLE "PluginState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastError" TEXT,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "installedAt" DATETIME,
    "enabledAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    "checksum" TEXT,
    "lastPreview" JSONB,
    "lastPreviewedAt" DATETIME
);

CREATE UNIQUE INDEX "PluginState_slug_key" ON "PluginState"("slug");
