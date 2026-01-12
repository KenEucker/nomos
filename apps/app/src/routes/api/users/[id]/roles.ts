import { z } from "zod";
import type { Ctx } from "../../../../platform/ctx.js";
import { HttpError } from "../../../../platform/errors.js";
import { modelSchemas, okResponse } from "../../_openapi.js";
import { serializeUser } from "../../_serializers.js";

const paramsSchema = z.object({ id: z.string() });
const bodySchema = z.object({ roles: z.array(z.string()) });

export const config = {
  auth: "required",
  roles: ["admin"],
  tags: ["Users"],
  summary: "Replace user roles",
  validate: { params: paramsSchema, body: bodySchema },
  openapi: {
    components: { schemas: modelSchemas },
    operation: {
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                roles: { type: "array", items: { type: "string" } }
              },
              required: ["roles"]
            }
          }
        }
      },
      responses: {
        200: {
          description: "Updated roles",
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

export const put = async (ctx: Ctx) => {
  const user = await ctx.prisma.user.findUnique({ where: { id: ctx.params.id } });
  if (!user) {
    throw new HttpError(404, "not_found", "User not found");
  }
  const roleRecords = await ctx.prisma.role.findMany({
    where: { key: { in: ctx.body.roles } }
  });
  await ctx.prisma.userRole.deleteMany({ where: { userId: user.id } });
  await ctx.prisma.userRole.createMany({
    data: roleRecords.map((role) => ({ userId: user.id, roleId: role.id }))
  });
  const updated = await ctx.prisma.user.findUnique({
    where: { id: user.id },
    include: { roles: { include: { role: true } } }
  });
  if (!updated) {
    throw new HttpError(404, "not_found", "User not found");
  }
  return ctx.json({ user: serializeUser(updated) });
};
