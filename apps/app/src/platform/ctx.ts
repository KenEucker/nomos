import type { FastifyRequest, FastifyReply } from "fastify";
import type { JobsRuntime } from "./jobs/runtime";
import type { EventBus } from "./events/bus";
import type { WebhookRuntime } from "./webhooks/outbound";
import type { ServicesRegistry } from "./plugins/registry";
import type { PrismaClient } from "@prisma/client";
import { HttpError } from "./errors";
import type { AppLogger } from "./logging/logger";
import type { Subject, Decision } from "./authz";
import type { NomosObserver } from "./observability";

/**
 * @deprecated Use Subject from authz module instead
 */
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
  /** The authenticated subject (user, apiKey, service, etc.) */
  subject: Subject | null;
  /** @deprecated Use subject instead */
  user: UserIdentity | null;
  /** @deprecated Use subject instead */
  apiClient: ApiClient | null;
  /** The authorization decision for this request (if intent was checked) */
  authzDecision?: Decision;
  db: InMemoryStore;
  prisma: PrismaClient;
  services: ServicesRegistry;
  events: EventBus;
  jobs: JobsRuntime;
  webhooks: WebhookRuntime;
  /**
   * Observability observer for emitting structured events.
   * Plugins and routes MUST use this instead of direct console logging.
   *
   * @example
   * ctx.observer?.event('user.action', {
   *   kind: 'audit',
   *   level: 'info',
   *   outcome: 'success',
   *   data: { userId: ctx.subject?.id, action: 'profile.update' },
   * }).emit();
   */
  observer: NomosObserver | null;
  auth: {
    requireUser: () => UserIdentity;
    requirePermission: (permission: string) => void;
    hasPermission: (permission: string) => boolean;
    /** Get the current subject */
    getSubject: () => Subject | null;
    /** Require a subject to be authenticated */
    requireSubject: () => Subject;
  };
  log: AppLogger;
  json: (payload: any, statusCode?: number, meta?: Record<string, any>) => Promise<void>;
  error: (statusCode: number, code: string, message: string, details?: unknown) => never;
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
  webhookDestinations: Map<string, any>;
  webhookDeliveries: any[];
  jobs: Map<string, any>;
  jobRuns: any[];
};

const hasWildcard = (permissions?: string[]) => permissions?.includes("*") ?? false;

const hasPermission = (permission: string, permissions?: string[]) => {
  if (!permissions) return false;
  return permissions.includes(permission) || hasWildcard(permissions);
};

export function createAuthHelpers(ctx: Omit<Ctx, "auth">): Ctx["auth"] {
  return {
    requireUser: () => {
      if (!ctx.user) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }
      return ctx.user;
    },
    requirePermission: (permission: string) => {
      const has = hasPermission(permission, ctx.user?.permissions) ||
        hasPermission(permission, ctx.apiClient?.permissions);
      if (!has) {
        throw new HttpError(403, "forbidden", "Missing permission", { permission });
      }
    },
    hasPermission: (permission: string) => {
      return (
        hasPermission(permission, ctx.user?.permissions) ||
        hasPermission(permission, ctx.apiClient?.permissions) ||
        false
      );
    },
    getSubject: () => {
      return ctx.subject;
    },
    requireSubject: () => {
      if (!ctx.subject) {
        throw new HttpError(401, "unauthorized", "Authentication required");
      }
      return ctx.subject;
    },
  };
}

export function jsonResponse(
  reply: FastifyReply,
  payload: any,
  statusCode = 200,
  meta?: Record<string, any>
) {
  const response: Record<string, any> = { ok: true, data: payload };
  if (meta) response.meta = meta;
  reply.code(statusCode).send(response);
}

export function errorResponse(
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): never {
  throw new HttpError(statusCode, code, message, details);
}
