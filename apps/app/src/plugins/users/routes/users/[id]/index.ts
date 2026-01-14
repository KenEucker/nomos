import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Ctx } from "../../../../../platform/ctx";
import { HttpError } from "../../../../../platform/errors";
import { modelSchemas, okResponse } from "../../../../../routes/_openapi";
import { serializeUser } from "../../../../../routes/_serializers";

const paramsSchema = z.object({ id: z.string() });

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  roles: z.array(z.string()).optional()
});

export const config = {
  auth: "required",
  roles: ["admin"],
  tags: ["Users"],
  summary: "Get user",
  validate: { params: paramsSchema },
  openapi: {
    components: { schemas: modelSchemas },
    operation: {
      responses: {
        200: {
          description: "User",
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
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.params.id },
    include: { roles: { include: { role: true } } }
  });
  if (!user) {
    throw new HttpError(404, "not_found", "User not found");
  }
  return ctx.json({ user: serializeUser(user) });
};

export const patchConfig = {
  auth: "required",
  roles: ["admin"],
  validate: { params: paramsSchema, body: patchSchema },
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
                name: { type: "string" },
                email: { type: "string", format: "email" },
                password: { type: "string" }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "Updated user",
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

export const patch = async (ctx: Ctx) => {
  const { name, email, password, roles } = ctx.body;
  const existing = await ctx.prisma.user.findUnique({ where: { id: ctx.params.id } });
  if (!existing) {
    throw new HttpError(404, "not_found", "User not found");
  }
  const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;

  // Update user fields
  const updated = await ctx.prisma.user.update({
    where: { id: ctx.params.id },
    data: {
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      ...(passwordHash ? { passwordHash } : {})
    },
    include: { roles: { include: { role: true } } }
  });

  // Update roles if provided
  if (roles !== undefined) {
    // Delete existing role associations
    await ctx.prisma.userRole.deleteMany({
      where: { userId: ctx.params.id }
    });
    // Create new role associations
    if (roles.length > 0) {
      const roleRecords = await ctx.prisma.role.findMany({
        where: { key: { in: roles } }
      });
      await ctx.prisma.userRole.createMany({
        data: roleRecords.map((role) => ({
          userId: ctx.params.id,
          roleId: role.id
        }))
      });
    }
    // Refetch with updated roles
    const refreshed = await ctx.prisma.user.findUnique({
      where: { id: ctx.params.id },
      include: { roles: { include: { role: true } } }
    });
    return ctx.json({ user: serializeUser(refreshed!) });
  }

  return ctx.json({ user: serializeUser(updated) });
};

export const delConfig = {
  auth: "required",
  roles: ["admin"],
  validate: { params: paramsSchema },
  openapi: {
    operation: {
      responses: {
        200: {
          description: "Deleted",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: { deleted: { type: "boolean", const: true } },
                required: ["deleted"]
              })
            }
          }
        }
      }
    }
  }
};

export const del = async (ctx: Ctx) => {
  const existing = await ctx.prisma.user.findUnique({ where: { id: ctx.params.id } });
  if (!existing) {
    throw new HttpError(404, "not_found", "User not found");
  }
  await ctx.prisma.user.delete({ where: { id: ctx.params.id } });
  return ctx.json({ deleted: true });
};
