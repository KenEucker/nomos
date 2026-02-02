import type { PrismaClient } from "@prisma/client";
import { nanoid } from "nanoid";
import { hashValue, compareHash } from "./hashing";

export type ApiKeyStore = Map<string, any> | PrismaClient;

function isPrisma(store: ApiKeyStore): store is PrismaClient {
  return typeof (store as PrismaClient).apiKey !== "undefined";
}

/**
 * Extract a prefix from the token for indexed lookups.
 * Uses the first 8 characters to balance selectivity and index size.
 */
function extractKeyPrefix(token: string): string {
  return token.substring(0, 8);
}

function sanitizeApiKeyRecord(record: {
  id: string;
  name: string;
  keyHash?: string;
  permissions?: unknown;
  allowedHosts?: string | null;
  revokedAt?: Date | null;
  createdAt: Date;
  lastUsedAt?: Date | null;
}) {
  let permissions: string[] = [];
  if (Array.isArray(record.permissions)) {
    permissions = record.permissions;
  } else if (record.permissions) {
    try {
      permissions = JSON.parse(String(record.permissions));
    } catch (err) {
      console.error(
        `[apiKeys] Failed to parse permissions for API key ${record.id}:`,
        err instanceof Error ? err.message : String(err)
      );
      permissions = [];
    }
  }

  let allowedHosts: string[] = [];
  if (typeof record.allowedHosts === "string" && record.allowedHosts) {
    try {
      allowedHosts = JSON.parse(record.allowedHosts) as string[];
    } catch (err) {
      console.error(
        `[apiKeys] Failed to parse allowedHosts for API key ${record.id}:`,
        err instanceof Error ? err.message : String(err)
      );
      allowedHosts = [];
    }
  }

  return {
    id: record.id,
    name: record.name,
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

export function createApiKey(store: ApiKeyStore, payload: any) {
  const token = nanoid(32);
  const keyHash = hashValue(token);
  const keyPrefix = extractKeyPrefix(token);
  const name = payload.name ?? "API Key";
  const permissions = payload.permissions ?? [];
  const allowedHosts = payload.allowedHosts ?? [];

  if (isPrisma(store)) {
    const created = store.apiKey.create({
      data: {
        keyHash,
        keyPrefix,
        name,
        permissions: permissions as any,
        allowedHosts: allowedHosts.length ? JSON.stringify(allowedHosts) : null,
      },
    });
    return (async () => {
      const record = await created;
      return {
        ...sanitizeApiKeyRecord({
          ...record,
          revokedAt: record.revokedAt,
          lastUsedAt: record.lastUsedAt,
        }),
        token,
      };
    })();
  }

  const id = nanoid();
  const entry = {
    id,
    name,
    hashedKey: keyHash,
    permissions,
    allowedHosts,
    revoked: false,
    createdAt: new Date().toISOString(),
  };
  (store as Map<string, any>).set(id, entry);
  return Promise.resolve({ ...entry, token });
}

export function rotateApiKey(store: ApiKeyStore, id: string) {
  const token = nanoid(32);
  const keyHash = hashValue(token);
  const keyPrefix = extractKeyPrefix(token);

  if (isPrisma(store)) {
    return store.apiKey
      .update({
        where: { id },
        data: { keyHash, keyPrefix, revokedAt: null },
      })
      .then((record) => ({
        ...sanitizeApiKeyRecord({
          ...record,
          revokedAt: record.revokedAt,
          lastUsedAt: record.lastUsedAt,
        }),
        token,
      }))
      .catch(() => null);
  }

  const map = store as Map<string, any>;
  const entry = map.get(id);
  if (!entry) return Promise.resolve(null);
  entry.hashedKey = keyHash;
  entry.revoked = false;
  return Promise.resolve({ ...entry, token });
}

export function revokeApiKey(store: ApiKeyStore, id: string) {
  if (isPrisma(store)) {
    return store.apiKey
      .update({
        where: { id },
        data: { revokedAt: new Date() },
      })
      .then((record) =>
        sanitizeApiKeyRecord({
          ...record,
          revokedAt: record.revokedAt,
          lastUsedAt: record.lastUsedAt,
        })
      )
      .catch(() => null);
  }

  const entry = (store as Map<string, any>).get(id);
  if (!entry) return Promise.resolve(null);
  entry.revoked = true;
  return Promise.resolve(entry);
}

export async function findApiKey(store: ApiKeyStore, token: string) {
  const keyPrefix = extractKeyPrefix(token);

  if (isPrisma(store)) {
    // Use indexed lookup by keyPrefix to avoid full table scan
    const keys = await store.apiKey.findMany({
      where: {
        keyPrefix,
        revokedAt: null,
      },
    });
    // Verify hash on the filtered candidates
    for (const record of keys) {
      if (compareHash(token, record.keyHash)) {
        return sanitizeApiKeyRecord({
          ...record,
          revokedAt: record.revokedAt,
          lastUsedAt: record.lastUsedAt,
        });
      }
    }
    return null;
  }

  const map = store as Map<string, any>;
  for (const entry of map.values()) {
    if (entry.revoked) continue;
    if (compareHash(token, entry.hashedKey)) {
      return entry;
    }
  }
  return null;
}
