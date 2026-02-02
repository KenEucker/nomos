import type { Ctx } from "../../../ctx";
import { HttpError } from "../../../errors";
import { modelSchemas, okResponse } from "../../../../routes/_openapi";
import { serializeUser } from "../../../../routes/_serializers";

export const config = {
  auth: "required",
  tags: ["Auth"],
  summary: "Get current session user",
  openapi: {
    components: { schemas: modelSchemas },
    operation: {
      responses: {
        200: {
          description: "Current user",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: { user: { $ref: "#/components/schemas/User" } },
                required: ["user"]
              })
            }
          }
        }
      }
    }
  }
};

export const get = async (ctx: Ctx) => {
  if (!ctx.subject) {
    throw new HttpError(401, "unauthorized", "Authentication required");
  }
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.subject.id },
    include: { roles: { include: { role: true } } }
  });
  if (!user) {
    throw new HttpError(401, "unauthorized", "Authentication required");
  }
  return ctx.json({ user: serializeUser(user) });
};
