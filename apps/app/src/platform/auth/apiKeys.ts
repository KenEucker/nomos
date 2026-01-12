import { nanoid } from "nanoid";
import { hashValue, compareHash } from "./hashing";

export function createApiKey(store: Map<string, any>, payload: any) {
  const token = nanoid(32);
  const id = nanoid();
  const entry = {
    id,
    name: payload.name ?? "API Key",
    hashedKey: hashValue(token),
    permissions: payload.permissions ?? [],
    allowedHosts: payload.allowedHosts ?? [],
    revoked: false,
    createdAt: new Date().toISOString()
  };
  store.set(id, entry);
  return { ...entry, token };
}

export function rotateApiKey(store: Map<string, any>, id: string) {
  const entry = store.get(id);
  if (!entry) return null;
  const token = nanoid(32);
  entry.hashedKey = hashValue(token);
  entry.revoked = false;
  return { ...entry, token };
}

export function revokeApiKey(store: Map<string, any>, id: string) {
  const entry = store.get(id);
  if (!entry) return null;
  entry.revoked = true;
  return entry;
}

export function findApiKey(store: Map<string, any>, token: string) {
  for (const entry of store.values()) {
    if (entry.revoked) continue;
    if (compareHash(token, entry.hashedKey)) {
      return entry;
    }
  }
  return null;
}
