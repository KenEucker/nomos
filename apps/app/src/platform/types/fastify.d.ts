import type { IncomingMessage, ServerResponse } from "node:http";

declare module "fastify" {
  interface FastifyContextConfig {
    routeId?: string;
  }

  interface FastifyRouteConfig {
    routeId?: string;
  }

  interface FastifyInstance {
    use(
      handler: (req: IncomingMessage, res: ServerResponse, next: (err?: Error) => void) => void
    ): FastifyInstance;
  }
}
