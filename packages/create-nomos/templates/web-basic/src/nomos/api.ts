export type LoginResponse = {
  ok: boolean;
  error?: { code: string; message: string };
};

export const getApiBase = (url: URL) => {
  return (
    process.env.PUBLIC_NOMOS_API_BASE ??
    process.env.NOMOS_API_ORIGIN ??
    url.origin
  );
};

export const login = async (request: Request, email: string, password: string) => {
  const baseUrl = getApiBase(new URL(request.url));
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return (await response.json()) as LoginResponse;
};
