export function sanitizeApiKeyEntry(record: {
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
