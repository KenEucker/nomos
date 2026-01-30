import type { PrismaClient } from "@prisma/client";
import { nanoid } from "nanoid";
import { hashValue, compareHash } from "./hashing";

export type ApiKeyStore = Map<string, any> | PrismaClient;

function isPrisma(store: ApiKeyStore): store is PrismaClient {
  return typeof (store as PrismaClient).apiKey !== "undefined";
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
  const permissions = Array.isArray(record.permissions)
    ? record.permissions
    : record.permissions
      ? JSON.parse(String(record.permissions))
      : [];
  const allowedHosts =
    typeof record.allowedHosts === "string" && record.allowedHosts
      ? (JSON.parse(record.allowedHosts) as string[])
      : [];
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
  const name = payload.name ?? "API Key";
  const permissions = payload.permissions ?? [];
  const allowedHosts = payload.allowedHosts ?? [];

  if (isPrisma(store)) {
    const created = store.apiKey.create({
      data: {
        keyHash,
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

  if (isPrisma(store)) {
    return store.apiKey
      .update({
        where: { id },
        data: { keyHash, revokedAt: null },
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
  if (isPrisma(store)) {
    const keys = await store.apiKey.findMany({
      where: { revokedAt: null },
    });
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
