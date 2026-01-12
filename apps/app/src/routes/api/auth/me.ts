import type { Ctx } from "../../../platform/ctx.js";
import { HttpError } from "../../../platform/errors.js";
import { modelSchemas, okResponse } from "../_openapi.js";
import { serializeUser } from "../_serializers.js";

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
  if (!ctx.user) {
    throw new HttpError(401, "unauthorized", "Authentication required");
  }
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.id },
    include: { roles: { include: { role: true } } }
  });
  if (!user) {
    throw new HttpError(401, "unauthorized", "Authentication required");
  }
  return ctx.json({ user: serializeUser(user) });
};
