import { z } from "zod";
import type { Ctx } from "../../platform/ctx";
import { HttpError } from "../../platform/errors";
import { modelSchemas, okResponse } from "../_openapi";

const paramsSchema = z.object({ id: z.string() });

const patchSchema = z.object({
  name: z.string().min(1).optional()
  // Note: key is not editable after creation
});

export const config = {
  auth: "required",
  roles: ["admin"],
  tags: ["Roles"],
  summary: "Get role",
  validate: { params: paramsSchema },
  openapi: {
    components: { schemas: modelSchemas },
    operation: {
      responses: {
        200: {
          description: "Role",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: { role: { $ref: "#/components/schemas/Role" } },
                required: ["role"]
              })
            }
          }
        }
      }
    }
  }
};

export const get = async (ctx: Ctx) => {
  const role = await ctx.prisma.role.findUnique({
    where: { id: ctx.params.id },
    include: { users: true }
  });
  if (!role) {
    throw new HttpError(404, "not_found", "Role not found");
  }
  return ctx.json({
    role: {
      id: role.id,
      key: role.key,
      name: role.name,
      userCount: role.users.length
    }
  });
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
                name: { type: "string" }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "Updated role",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: { role: { $ref: "#/components/schemas/Role" } },
                required: ["role"]
              })
            }
          }
        }
      }
    }
  }
};

export const patch = async (ctx: Ctx) => {
  const { name } = ctx.body;
  const existing = await ctx.prisma.role.findUnique({ where: { id: ctx.params.id } });
  if (!existing) {
    throw new HttpError(404, "not_found", "Role not found");
  }

  const updated = await ctx.prisma.role.update({
    where: { id: ctx.params.id },
    data: {
      ...(name ? { name } : {})
    }
  });

  return ctx.json({ role: updated });
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
  const existing = await ctx.prisma.role.findUnique({
    where: { id: ctx.params.id },
    include: { users: true }
  });
  if (!existing) {
    throw new HttpError(404, "not_found", "Role not found");
  }

  // Prevent deleting roles that are still in use
  if (existing.users.length > 0) {
    throw new HttpError(400, "role_in_use", `Cannot delete role: ${existing.users.length} user(s) still have this role`);
  }

  await ctx.prisma.role.delete({ where: { id: ctx.params.id } });
  return ctx.json({ deleted: true });
};
