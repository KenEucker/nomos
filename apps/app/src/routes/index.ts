import { getOpenApiSpec, OPENAPI_DOCS_PATH, OPENAPI_JSON_PATH } from "../platform/openapi/spec";
import type { Ctx } from "../platform/ctx";

export const config = {
  auth: "none",
  tags: ["system"],
  summary: "API index"
};

type Resource = {
  id: string;
  href: string;
  methods: string[];
};

const METHOD_KEYS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

export function extractResourcesFromOpenApi(spec: { paths?: Record<string, any> }): Resource[] {
  const resources = new Map<string, Set<string>>();
  const paths = spec.paths ?? {};

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    const firstSegment = pathKey.split("/")[1];
    if (!firstSegment) continue;
    if (!pathItem || typeof pathItem !== "object") continue;

    let methods = resources.get(firstSegment);
    if (!methods) {
      methods = new Set<string>();
      resources.set(firstSegment, methods);
    }

    for (const method of METHOD_KEYS) {
      if ((pathItem as Record<string, unknown>)[method]) {
        methods.add(method.toUpperCase());
      }
    }
  }

  return Array.from(resources.entries())
    .map(([id, methodSet]) => ({
      id,
      href: `/${id}`,
      methods: Array.from(methodSet).sort()
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

const renderHtml = (name: string, version: string | undefined, resources: Resource[]) => {
  const versionLabel = version ? ` <small>v${version}</small>` : "";
  const resourceList = resources
    .map(
      (resource) =>
        `<li><a href="${resource.href}">${resource.href}</a> <span>(${resource.methods.join(
          ", "
        )})</span></li>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${name}${version ? ` v${version}` : ""}</title>
  </head>
  <body>
    <h1>${name}${versionLabel}</h1>
    <p>
      <a href="${OPENAPI_DOCS_PATH}">Docs</a>
      | <a href="${OPENAPI_JSON_PATH}">OpenAPI JSON</a>
    </p>
    <h2>Resources</h2>
    <ul>
      ${resourceList}
    </ul>
  </body>
</html>`;
};

export const get = async (ctx: Ctx) => {
  const spec = getOpenApiSpec();
  const name = spec.info?.title ?? "API";
  const version = spec.info?.version;
  const resources = extractResourcesFromOpenApi(spec);
  const outputParam =
    typeof ctx.query.output === "string" ? ctx.query.output.toLowerCase() : undefined;

  if (outputParam === "html") {
    ctx.reply.type("text/html; charset=utf-8").send(renderHtml(name, version, resources));
    return;
  }

  const payload: {
    name: string;
    version?: string;
    openapi: string;
    docs: string;
    resources: Resource[];
  } = {
    name,
    openapi: OPENAPI_JSON_PATH,
    docs: OPENAPI_DOCS_PATH,
    resources
  };

  if (version) {
    payload.version = version;
  }

  ctx.reply.type("application/json; charset=utf-8").send(payload);
};
