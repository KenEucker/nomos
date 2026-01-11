import type { Middleware } from "./types.js";

export type MiddlewareRegistry = Map<string, (...args: any[]) => Middleware>;

export function createMiddlewareRegistry(): MiddlewareRegistry {
  return new Map();
}

export function resolveMiddleware(
  registry: MiddlewareRegistry,
  entry: string
): Middleware {
  const [name, argsText] = entry.split(":");
  const factory = registry.get(name);
  if (!factory) {
    throw new Error(`Unknown middleware: ${name}`);
  }
  const args = argsText ? argsText.split(",") : [];
  return factory(...args);
}
