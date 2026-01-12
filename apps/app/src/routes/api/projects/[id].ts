import { z } from "zod";
import type { Ctx } from "../../../platform/ctx";
import { HttpError } from "../../../platform/errors";
import { modelSchemas, okResponse } from "../_openapi";
import { serializeProject } from "../_serializers";

const paramsSchema = z.object({ id: z.string() });
const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable()
});

export const config = {
  auth: "required",
  roles: ["viewer", "editor", "admin"],
  tags: ["Projects"],
  summary: "Get project",
  validate: { params: paramsSchema },
  openapi: {
    components: { schemas: modelSchemas },
    operation: {
      responses: {
        200: {
          description: "Project",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: { project: { $ref: "#/components/schemas/Project" } },
                required: ["project"]
              })
            }
          }
        }
      }
    }
  }
};

export const get = async (ctx: Ctx) => {
  const project = await ctx.prisma.project.findUnique({ where: { id: ctx.params.id } });
  if (!project) {
    throw new HttpError(404, "not_found", "Project not found");
  }
  return ctx.json({ project: serializeProject(project) });
};

export const patchConfig = {
  auth: "required",
  roles: ["editor", "admin"],
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
                description: { type: "string", nullable: true }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "Updated project",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: { project: { $ref: "#/components/schemas/Project" } },
                required: ["project"]
              })
            }
          }
        }
      }
    }
  }
};

export const patch = async (ctx: Ctx) => {
  const project = await ctx.prisma.project.findUnique({ where: { id: ctx.params.id } });
  if (!project) {
    throw new HttpError(404, "not_found", "Project not found");
  }
  const updated = await ctx.prisma.project.update({
    where: { id: ctx.params.id },
    data: {
      ...(ctx.body.name ? { name: ctx.body.name } : {}),
      ...(ctx.body.description !== undefined ? { description: ctx.body.description } : {})
    }
  });
  return ctx.json({ project: serializeProject(updated) });
};

export const delConfig = {
  auth: "required",
  roles: ["editor", "admin"],
  validate: { params: paramsSchema },
  description: "Editors may delete their own projects; admins can delete any.",
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
  if (!ctx.user) {
    throw new HttpError(401, "unauthorized", "Authentication required");
  }
  const project = await ctx.prisma.project.findUnique({ where: { id: ctx.params.id } });
  if (!project) {
    throw new HttpError(404, "not_found", "Project not found");
  }
  const isAdmin = ctx.user.roles.includes("admin");
  const isCreator = project.createdByUserId === ctx.user.id;
  if (!isAdmin && !isCreator) {
    throw new HttpError(403, "forbidden", "Only admins or creators can delete a project");
  }
  await ctx.prisma.project.delete({ where: { id: ctx.params.id } });
  return ctx.json({ deleted: true });
};
