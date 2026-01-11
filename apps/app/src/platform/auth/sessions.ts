import { nanoid } from "nanoid";

export function createSession(store: Map<string, any>, userId: string) {
  const sessionId = nanoid();
  store.set(sessionId, { id: sessionId, userId, createdAt: new Date().toISOString() });
  return sessionId;
}

export function getSession(store: Map<string, any>, sessionId: string) {
  return store.get(sessionId) ?? null;
}

export function revokeSession(store: Map<string, any>, sessionId: string) {
  return store.delete(sessionId);
}
