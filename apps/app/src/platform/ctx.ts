import type { FastifyRequest, FastifyReply } from "fastify";
import type { JobsRuntime } from "./jobs/runtime.js";
import type { EventBus } from "./events/bus.js";
import type { WebhookRuntime } from "./webhooks/outbound.js";
import type { ServicesRegistry } from "./plugins/registry.js";
import { HttpError } from "./errors.js";

export type UserIdentity = {
  id: string;
  roles: string[];
  permissions: string[];
};

export type ApiClient = {
  id: string;
  name: string;
  permissions: string[];
  allowedHosts: string[];
};

export type Ctx = {
  reqId: string;
  method: string;
  path: string;
  params: Record<string, any>;
  query: Record<string, any>;
  body: any;
  headers: Record<string, string | string[] | undefined>;
  user: UserIdentity | null;
  apiClient: ApiClient | null;
  db: InMemoryStore;
  services: ServicesRegistry;
  events: EventBus;
  jobs: JobsRuntime;
  webhooks: WebhookRuntime;
  auth: {
    requireUser: () => UserIdentity;
    requirePermission: (permission: string) => void;
    hasPermission: (permission: string) => boolean;
  };
  json: (payload: any, statusCode?: number) => Promise<void>;
  error: (statusCode: number, message: string, details?: unknown) => never;
  req: FastifyRequest;
  reply: FastifyReply;
};

export type Handler = (ctx: Ctx) => Promise<any> | any;

export type InMemoryStore = {
  users: Map<string, any>;
  roles: Map<string, any>;
  permissions: Set<string>;
  apiKeys: Map<string, any>;
  sessions: Map<string, any>;
  auditLog: any[];
  errors: any[];
  webhookDestinations: Map<string, any>;
  webhookDeliveries: any[];
  jobs: Map<string, any>;
  jobRuns: any[];
};

export function createAuthHelpers(ctx: Omit<Ctx, "auth">): Ctx["auth"] {
  return {
    requireUser: () => {
      if (!ctx.user) {
        throw new HttpError(401, "Authentication required");
      }
      return ctx.user;
    },
    requirePermission: (permission: string) => {
      const has = ctx.user?.permissions.includes(permission) ||
        ctx.apiClient?.permissions.includes(permission);
      if (!has) {
        throw new HttpError(403, "Missing permission", { permission });
      }
    },
    hasPermission: (permission: string) => {
      return (
        ctx.user?.permissions.includes(permission) ||
        ctx.apiClient?.permissions.includes(permission) ||
        false
      );
    }
  };
}

export function jsonResponse(reply: FastifyReply, payload: any, statusCode = 200) {
  reply.code(statusCode).send(payload);
}

export function errorResponse(statusCode: number, message: string, details?: unknown): never {
  throw new HttpError(statusCode, message, details);
}
