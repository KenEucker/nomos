import { authBypassUser, type SessionUser } from "../session";
import { serverApiGet, ServerApiError } from "./api";

type AstroContext = {
  request: Request;
  redirect: (path: string, status?: 300 | 301 | 302 | 303 | 304 | 307 | 308) => Response;
};

export async function requireAdminSession(Astro: AstroContext) {
  try {
    const response = await serverApiGet<{ user: SessionUser }>(Astro.request, "/auth/me");
    const user = response.data?.user ?? null;
    if (!user) {
      return Astro.redirect("/admin/login");
    }
    return user;
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 401) {
      return Astro.redirect("/admin/login");
    }
    if (error instanceof ServerApiError && error.status === 404) {
      return authBypassUser;
    }
    throw error;
  }
}
