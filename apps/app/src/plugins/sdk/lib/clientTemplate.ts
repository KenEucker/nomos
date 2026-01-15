export const OPENAPI_FETCH_URL = "https://esm.sh/openapi-fetch@0.5.0";

type ClientSourceOptions = {
  includeTypes: boolean;
};

export function buildClientSource({ includeTypes }: ClientSourceOptions) {
  const typeExports = includeTypes
    ? `export type NomosClientOptions = {
  baseUrl: string;
  credentials?: RequestCredentials;
  headers?: Record<string, string> | (() => Promise<Record<string, string>>);
  apiKey?: string | (() => string | Promise<string>);
  authHeaderName?: "Authorization" | "X-API-Key";
  fetch?: typeof fetch;
};

export type NomosClient = ReturnType<typeof createNomosClient>;
`
    : "";

  return `import createClient from "${OPENAPI_FETCH_URL}";

${typeExports}export class NomosApiError extends Error {
  status;
  code;
  details;
  payload;
  constructor(message, options = {}) {
    super(message);
    this.name = "NomosApiError";
    this.status = options.status ?? 0;
    this.code = options.code;
    this.details = options.details;
    this.payload = options.payload;
  }
}

export class NomosNetworkError extends Error {
  cause;
  constructor(message, cause) {
    super(message);
    this.name = "NomosNetworkError";
    this.cause = cause;
  }
}

export class NomosUnauthorizedError extends NomosApiError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "NomosUnauthorizedError";
  }
}

export class NomosForbiddenError extends NomosApiError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "NomosForbiddenError";
  }
}

export class NomosNotFoundError extends NomosApiError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "NomosNotFoundError";
  }
}

export class NomosModuleUnavailableError extends NomosApiError {
  module;
  constructor(moduleName, message = "Module unavailable", options = {}) {
    super(message, options);
    this.name = "NomosModuleUnavailableError";
    this.module = moduleName;
  }
}

export class NomosValidationError extends NomosApiError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "NomosValidationError";
  }
}

const DEFAULT_CREDENTIALS = "include";

const BUILTIN_MODULES = {
  auth: {
    loginPath: "/auth/login",
    logoutPath: "/auth/logout",
    mePath: "/auth/me"
  },
  health: { path: "/health" },
  ready: { path: "/ready" },
  version: { path: "/version" },
  users: { basePath: "/users" }
};

const ensureBaseUrl = (value) => (value ? value.replace(/\\/$/, "") : "");

export function createNomosClient(opts) {
  if (!opts || !opts.baseUrl) {
    throw new Error("createNomosClient requires a baseUrl.");
  }

  const baseUrl = ensureBaseUrl(opts.baseUrl);
  const credentials = opts.credentials ?? DEFAULT_CREDENTIALS;
  const fetchImpl = opts.fetch ?? fetch;
  const client = createClient({ baseUrl, fetch: fetchImpl });

  const cache = {
    apiRevision: null,
    schemas: new Map(),
    resources: new Map()
  };

  const resolveHeaders = async (extraHeaders) => {
    const baseHeaders =
      typeof opts.headers === "function" ? await opts.headers() : opts.headers ?? {};
    const apiKey = typeof opts.apiKey === "function" ? await opts.apiKey() : opts.apiKey;
    const authHeaderName = opts.authHeaderName ?? "Authorization";
    const headers = { ...baseHeaders, ...(extraHeaders ?? {}) };

    if (apiKey) {
      if (authHeaderName === "Authorization") {
        headers[authHeaderName] = apiKey.startsWith("Bearer ") ? apiKey : \`Bearer \${apiKey}\`;
      } else {
        headers[authHeaderName] = apiKey;
      }
    }

    return headers;
  };

  const toApiError = (response, payload, path) => {
    const status = response?.status ?? 0;
    const details = payload?.error?.details ?? payload?.details;
    const code = payload?.error?.code ?? payload?.code ?? "api_error";
    const message =
      payload?.error?.message ?? payload?.message ?? \`Request failed with status \${status}\`;

    if (path.startsWith(BUILTIN_MODULES.users.basePath) && status === 404) {
      return new NomosModuleUnavailableError("users", message, {
        status,
        code,
        details,
        payload
      });
    }

    switch (status) {
      case 400:
        return new NomosValidationError(message, { status, code, details, payload });
      case 401:
        return new NomosUnauthorizedError(message, { status, code, details, payload });
      case 403:
        return new NomosForbiddenError(message, { status, code, details, payload });
      case 404:
        return new NomosNotFoundError(message, { status, code, details, payload });
      default:
        return new NomosApiError(message, { status, code, details, payload });
    }
  };

  const execute = async (method, path, options = {}) => {
    try {
      const headers = await resolveHeaders(options.headers);
      const result = await client.request({
        ...options,
        method,
        path,
        headers,
        credentials
      });
      if (result.error) {
        throw toApiError(result.response, result.error, path);
      }
      return { data: result.data, response: result.response };
    } catch (err) {
      if (err instanceof NomosApiError) {
        throw err;
      }
      throw new NomosNetworkError("Network request failed", err);
    }
  };

  const ensureUsersModule = async (path) => {
    if (!path.startsWith(BUILTIN_MODULES.users.basePath)) return;
    const available = await meta.hasModule("users");
    if (!available) {
      throw new NomosModuleUnavailableError("users", "Users module is disabled", {
        status: 404,
        code: "module_unavailable"
      });
    }
  };

  const request = async ({ method, path, ...options }) => {
    await ensureUsersModule(path);
    const { data } = await execute(method, path, options);
    return data;
  };

  const meta = {
    schemas: async () => {
      const revision = await meta.getRevision();
      if (revision && cache.schemas.has(revision)) {
        return cache.schemas.get(revision);
      }
      const spec = await request({ method: "GET", path: "/openapi.json" });
      const schemas = spec?.components?.schemas ?? {};
      if (revision) {
        cache.schemas.set(revision, schemas);
      }
      return schemas;
    },
    resources: async () => {
      const revision = await meta.getRevision();
      if (revision && cache.resources.has(revision)) {
        return cache.resources.get(revision);
      }
      const root = await request({ method: "GET", path: "/" });
      const resources = root?.resources ?? [];
      if (revision) {
        cache.resources.set(revision, resources);
      }
      return resources;
    },
    hasCapabilities: async (names) => {
      const resources = await meta.resources();
      const available = new Set(resources.map((resource) => resource.id));
      return names.every((name) => available.has(name));
    },
    hasModule: async (name) => {
      const resources = await meta.resources();
      return resources.some((resource) => resource.id === name);
    },
    invalidate: () => {
      cache.apiRevision = null;
      cache.schemas.clear();
      cache.resources.clear();
    },
    getRevision: async () => {
      if (cache.apiRevision) return cache.apiRevision;
      const version = await request({ method: "GET", path: BUILTIN_MODULES.version.path });
      cache.apiRevision = version?.apiRevision ?? version?.data?.apiRevision ?? null;
      return cache.apiRevision;
    }
  };

  const resources = {
    list: async (resourceKey, query) =>
      request({
        method: "GET",
        path: \`/\${resourceKey}\`,
        params: query ? { query } : undefined
      }),
    get: async (resourceKey, id) =>
      request({ method: "GET", path: \`/\${resourceKey}/\${id}\` }),
    create: async (resourceKey, data) =>
      request({ method: "POST", path: \`/\${resourceKey}\`, body: data }),
    update: async (resourceKey, id, patch) =>
      request({ method: "PATCH", path: \`/\${resourceKey}/\${id}\`, body: patch }),
    delete: async (resourceKey, id) =>
      request({ method: "DELETE", path: \`/\${resourceKey}/\${id}\` }),
    action: async (resourceKey, actionKey, payload) =>
      request({
        method: "POST",
        path: \`/\${resourceKey}/actions/\${actionKey}\`,
        body: payload
      })
  };

  return {
    ...client,
    GET: (path, options) => request({ method: "GET", path, ...options }),
    POST: (path, options) => request({ method: "POST", path, ...options }),
    PUT: (path, options) => request({ method: "PUT", path, ...options }),
    PATCH: (path, options) => request({ method: "PATCH", path, ...options }),
    DELETE: (path, options) => request({ method: "DELETE", path, ...options }),
    request,
    meta,
    resources,
    modules: BUILTIN_MODULES
  };
}

let singletonClient = null;

const getDefaultBaseUrl = () => {
  if (typeof globalThis === "undefined") return "";
  if ("location" in globalThis && globalThis.location?.origin) {
    return globalThis.location.origin;
  }
  return "";
};

export function getSingletonClient(options = {}) {
  if (!singletonClient || options.force) {
    const { force, ...rest } = options;
    const baseUrl = rest.baseUrl ?? getDefaultBaseUrl();
    singletonClient = createNomosClient({ ...rest, baseUrl });
  }
  return singletonClient;
}
`;
}

export function buildClientTypeDeclarations() {
  return `
export type NomosClientOptions = {
  baseUrl: string;
  credentials?: RequestCredentials;
  headers?: Record<string, string> | (() => Promise<Record<string, string>>);
  apiKey?: string | (() => string | Promise<string>);
  authHeaderName?: "Authorization" | "X-API-Key";
  fetch?: typeof fetch;
};

export type NomosSingletonOptions = NomosClientOptions & {
  force?: boolean;
};

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";
export type RequestMethod = HttpMethod | Uppercase<HttpMethod>;

export type PathsWithMethod<Paths, Method extends HttpMethod> = {
  [Path in keyof Paths]: Paths[Path] extends Record<Method, unknown> ? Path : never;
}[keyof Paths];

export type OperationFor<
  Paths,
  Method extends HttpMethod,
  Path extends PathsWithMethod<Paths, Method>
> = Paths[Path] extends Record<Method, unknown> ? Paths[Path][Method] : never;

type OperationParams<Op> = Op extends { parameters: infer Params } ? Params : Record<string, never>;

type OperationRequestBody<Op> = Op extends {
  requestBody: { content: infer Content };
}
  ? "application/json" extends keyof Content
    ? Content["application/json"]
    : "application/*+json" extends keyof Content
      ? Content["application/*+json"]
      : Content[keyof Content]
  : undefined;

type ResponseForStatus<Responses, Status extends string | number> =
  Status extends keyof Responses ? Responses[Status] : undefined;

type SuccessResponse<Responses> =
  ResponseForStatus<Responses, 200> extends undefined
    ? ResponseForStatus<Responses, "200"> extends undefined
      ? ResponseForStatus<Responses, 201> extends undefined
        ? ResponseForStatus<Responses, "201"> extends undefined
          ? ResponseForStatus<Responses, 204> extends undefined
            ? ResponseForStatus<Responses, "204"> extends undefined
              ? Responses[keyof Responses]
              : Responses["204"]
            : Responses[204]
          : Responses["201"]
        : Responses[201]
      : Responses["200"]
    : Responses[200];

type JsonFromResponse<Response> = Response extends { content: infer Content }
  ? "application/json" extends keyof Content
    ? Content["application/json"]
    : "application/*+json" extends keyof Content
      ? Content["application/*+json"]
      : Content[keyof Content]
  : void;

type OperationResponse<Op> = Op extends { responses: infer Responses }
  ? JsonFromResponse<SuccessResponse<Responses>>
  : void;

type NomosRequestOptions<Op> = {
  params?: OperationParams<Op>;
  body?: OperationRequestBody<Op>;
  headers?: Record<string, string>;
};

export type NomosResourceSummary = {
  id: string;
  href: string;
  methods: string[];
};

export class NomosApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  payload?: unknown;
}

export class NomosNetworkError extends Error {
  cause?: unknown;
}

export class NomosUnauthorizedError extends NomosApiError {}
export class NomosForbiddenError extends NomosApiError {}
export class NomosNotFoundError extends NomosApiError {}
export class NomosModuleUnavailableError extends NomosApiError {
  module?: string;
}
export class NomosValidationError extends NomosApiError {}

export type NomosClient = {
  GET<Path extends PathsWithMethod<paths, "get">>(
    path: Path,
    options?: NomosRequestOptions<OperationFor<paths, "get", Path>>
  ): Promise<OperationResponse<OperationFor<paths, "get", Path>>>;
  GET(path: string, options?: NomosRequestOptions<unknown>): Promise<unknown>;
  POST<Path extends PathsWithMethod<paths, "post">>(
    path: Path,
    options?: NomosRequestOptions<OperationFor<paths, "post", Path>>
  ): Promise<OperationResponse<OperationFor<paths, "post", Path>>>;
  POST(path: string, options?: NomosRequestOptions<unknown>): Promise<unknown>;
  PUT<Path extends PathsWithMethod<paths, "put">>(
    path: Path,
    options?: NomosRequestOptions<OperationFor<paths, "put", Path>>
  ): Promise<OperationResponse<OperationFor<paths, "put", Path>>>;
  PUT(path: string, options?: NomosRequestOptions<unknown>): Promise<unknown>;
  PATCH<Path extends PathsWithMethod<paths, "patch">>(
    path: Path,
    options?: NomosRequestOptions<OperationFor<paths, "patch", Path>>
  ): Promise<OperationResponse<OperationFor<paths, "patch", Path>>>;
  PATCH(path: string, options?: NomosRequestOptions<unknown>): Promise<unknown>;
  DELETE<Path extends PathsWithMethod<paths, "delete">>(
    path: Path,
    options?: NomosRequestOptions<OperationFor<paths, "delete", Path>>
  ): Promise<OperationResponse<OperationFor<paths, "delete", Path>>>;
  DELETE(path: string, options?: NomosRequestOptions<unknown>): Promise<unknown>;
  request<Method extends HttpMethod, Path extends PathsWithMethod<paths, Method>>(options: {
    method: Method | Uppercase<Method>;
    path: Path;
    params?: OperationParams<OperationFor<paths, Method, Path>>;
    body?: OperationRequestBody<OperationFor<paths, Method, Path>>;
    headers?: Record<string, string>;
  }): Promise<OperationResponse<OperationFor<paths, Method, Path>>>;
  request(options: {
    method: string;
    path: string;
    params?: Record<string, unknown>;
    body?: unknown;
    headers?: Record<string, string>;
  }): Promise<unknown>;
  meta: {
    schemas: () => Promise<Record<string, unknown>>;
    resources: () => Promise<NomosResourceSummary[]>;
    hasCapabilities: (names: string[]) => Promise<boolean>;
    hasModule: (name: string) => Promise<boolean>;
    invalidate: () => void;
  };
  resources: {
    list: <T = unknown>(
      resourceKey: string,
      query?: Record<string, unknown>
    ) => Promise<T>;
    get: <T = unknown>(resourceKey: string, id: string) => Promise<T>;
    create: <T = unknown>(resourceKey: string, data: Record<string, unknown>) => Promise<T>;
    update: <T = unknown>(
      resourceKey: string,
      id: string,
      patch: Record<string, unknown>
    ) => Promise<T>;
    delete: (resourceKey: string, id: string) => Promise<void>;
    action: <T = unknown>(
      resourceKey: string,
      actionKey: string,
      payload?: Record<string, unknown>
    ) => Promise<T>;
  };
  modules: {
    auth: { loginPath: string; logoutPath: string; mePath: string };
    health: { path: string };
    ready: { path: string };
    version: { path: string };
    users: { basePath: string };
  };
};

export function createNomosClient(opts: NomosClientOptions): NomosClient;
export function getSingletonClient(opts?: NomosSingletonOptions): NomosClient;
`;
}
