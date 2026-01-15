import { writable } from "svelte/store";
const sdkModulePromise = import("/sdk/client.js");

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  roles: string[];
};

export const authBypassUser: SessionUser = {
  id: "system",
  email: "system@nomos.local",
  name: "System",
  roles: ["admin"]
};

export const session = writable<SessionUser | null>(null);

export async function loadSession() {
  try {
    const client = (await sdkModulePromise).getSingletonClient();
    const response = await client.GET("/auth/me");
    const user = response.data?.user ?? null;
    session.set(user);
    return user;
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 404) {
      session.set(authBypassUser);
      return authBypassUser;
    }
    session.set(null);
    throw error;
  }
}

export function hasRole(user: SessionUser | null, role: string) {
  return Boolean(user?.roles.includes(role));
}
