import { writable } from "svelte/store";
import { apiGet } from "./api";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  roles: string[];
};

export const session = writable<SessionUser | null>(null);

export async function loadSession() {
  const response = await apiGet<{ user: SessionUser }>("/api/auth/me");
  session.set(response.data?.user ?? null);
  return response.data?.user ?? null;
}

export function hasRole(user: SessionUser | null, role: string) {
  return Boolean(user?.roles.includes(role));
}
