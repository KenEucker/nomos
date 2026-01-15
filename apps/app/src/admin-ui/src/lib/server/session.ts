import { authBypassUser, type SessionUser } from "../session";

type AstroContext = {
  request: Request;
  redirect: (path: string, status?: 300 | 301 | 302 | 303 | 304 | 307 | 308) => Response;
};

const sdkModulePromise = import(
  new URL("../../../../plugins/sdk/dist/client.js", import.meta.url).href
);

const buildHeaders = (request: Request) => {
  const headers: Record<string, string> = {};
  const cookie = request.headers.get("cookie");
  if (cookie) headers.cookie = cookie;
  const authorization = request.headers.get("authorization");
  if (authorization) headers.authorization = authorization;
  return headers;
};

const resolveServerOrigin = (request: Request) => {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
  const host = forwardedHost ?? request.headers.get("host") ?? requestUrl.host;
  let origin = `${forwardedProto}://${host}`;

  const astroDevPort = Number(process.env.ASTRO_DEV_PORT ?? 4321);
  const appPort = process.env.PORT ?? "3001";
  if (host.endsWith(`:${astroDevPort}`)) {
    origin = `${forwardedProto}://localhost:${appPort}`;
  }

  return origin;
};

export async function requireAdminSession(Astro: AstroContext) {
  try {
    const sdkModule = await sdkModulePromise;
    const client = sdkModule.createNomosClient({
      baseUrl: resolveServerOrigin(Astro.request),
      headers: buildHeaders(Astro.request)
    });
    const response = await client.GET("/auth/me");
    const user = response.data?.user ?? null;
    if (!user) {
      return Astro.redirect("/admin/login");
    }
    return user;
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) {
      return Astro.redirect("/admin/login");
    }
    if (status === 404) {
      return authBypassUser;
    }
    throw error;
  }
}
