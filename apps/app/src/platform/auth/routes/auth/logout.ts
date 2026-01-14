import type { Ctx } from "../../../ctx";
import { revokeSession } from "../../sessions";
import { okResponse } from "../../../../routes/_openapi";

export const config = {
  auth: "required",
  tags: ["Auth"],
  summary: "Logout",
  openapi: {
    operation: {
      responses: {
        200: {
          description: "Logged out",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: { loggedOut: { type: "boolean", const: true } },
                required: ["loggedOut"]
              })
            }
          }
        }
      }
    }
  }
};

export const post = async (ctx: Ctx) => {
  const sessionId = ctx.req.cookies?.session_id;
  if (sessionId) {
    await revokeSession(ctx.prisma, sessionId);
  }
  ctx.reply.clearCookie("session_id", { path: "/" });
  return ctx.json({ loggedOut: true });
};
