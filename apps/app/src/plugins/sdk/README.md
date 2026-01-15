# Nomos SDK (Runtime, Path-Based)

Nomos generates a runtime SDK from the current OpenAPI document and serves it from your Nomos instance. The SDK is **not** published as a package; it is generated on the server and requested by clients at runtime.

## Installation

The SDK is generated and served by the Nomos server. There is nothing to install in your frontend package.json.

## Creating the Client

```ts
const version = await fetch("/version").then((res) => res.json());
const sdkModule = await import(`/sdk/client.js?rev=${version.apiRevision}`);
const client = sdkModule.createNomosClient({ baseUrl: "https://example.com" });
```

## Auth Modes

```ts
const client = createNomosClient({
  baseUrl: "https://example.com",
  credentials: "include",
  apiKey: async () => "my-token",
  authHeaderName: "Authorization"
});
```

## Swagger-Aligned Paths

Path-based calls mirror Swagger UI:

```ts
await client.GET("/users", { params: { query: { page: 1 } } });
await client.POST("/auth/login", { body: { email, password } });
```

## Runtime Plugin Enable/Disable

Plugins can be enabled or disabled without rebuilding the client. Always fetch the client with the latest API revision:

```ts
const { apiRevision } = await fetch("/version").then((res) => res.json());
const sdk = await import(`/sdk/client.js?rev=${apiRevision}`);
```

## Capability Discovery

```ts
const schemas = await client.meta.schemas();
const resources = await client.meta.resources();
const hasUsers = await client.meta.hasModule("users");
```

## Resource Abstraction

```ts
await client.resources.list("users", { page: 1 });
await client.resources.get("users", "user_123");
await client.resources.create("users", { email: "user@example.com" });
```

## Error Handling

```ts
try {
  await client.GET("/users");
} catch (err) {
  if (err instanceof sdkModule.NomosUnauthorizedError) {
    // handle auth
  }
}
```

## Caching & API Revisions

The SDK caches schemas/resources by API revision. Call `client.meta.invalidate()` to clear caches when the revision changes.
