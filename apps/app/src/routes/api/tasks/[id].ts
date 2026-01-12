import { z } from "zod";
import type { Ctx } from "../../../platform/ctx";
import { HttpError } from "../../../platform/errors";
import { modelSchemas, okResponse } from "../_openapi";
import { serializeTask } from "../_serializers";

const paramsSchema = z.object({ id: z.string() });
const patchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["todo", "doing", "done"]).optional(),
  assignedToUserId: z.string().optional().nullable()
});

export const config = {
  auth: "required",
  roles: ["viewer", "editor", "admin"],
  tags: ["Tasks"],
  summary: "Get task",
  validate: { params: paramsSchema },
  openapi: {
    components: { schemas: modelSchemas },
    operation: {
      responses: {
        200: {
          description: "Task",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: { task: { $ref: "#/components/schemas/Task" } },
                required: ["task"]
              })
            }
          }
        }
      }
    }
  }
};

export const get = async (ctx: Ctx) => {
  const task = await ctx.prisma.task.findUnique({ where: { id: ctx.params.id } });
  if (!task) {
    throw new HttpError(404, "not_found", "Task not found");
  }
  return ctx.json({ task: serializeTask(task) });
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
                title: { type: "string" },
                description: { type: "string", nullable: true },
                status: { type: "string", enum: ["todo", "doing", "done"] },
                assignedToUserId: { type: "string", nullable: true }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "Updated task",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: { task: { $ref: "#/components/schemas/Task" } },
                required: ["task"]
              })
            }
          }
        }
      }
    }
  }
};

export const patch = async (ctx: Ctx) => {
  const task = await ctx.prisma.task.findUnique({ where: { id: ctx.params.id } });
  if (!task) {
    throw new HttpError(404, "not_found", "Task not found");
  }
  const updated = await ctx.prisma.task.update({
    where: { id: ctx.params.id },
    data: {
      ...(ctx.body.title ? { title: ctx.body.title } : {}),
      ...(ctx.body.description !== undefined ? { description: ctx.body.description } : {}),
      ...(ctx.body.status ? { status: ctx.body.status } : {}),
      ...(ctx.body.assignedToUserId !== undefined
        ? { assignedToUserId: ctx.body.assignedToUserId }
        : {})
    }
  });
  return ctx.json({ task: serializeTask(updated) });
};

export const delConfig = {
  auth: "required",
  roles: ["editor", "admin"],
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
  const task = await ctx.prisma.task.findUnique({ where: { id: ctx.params.id } });
  if (!task) {
    throw new HttpError(404, "not_found", "Task not found");
  }
  await ctx.prisma.task.delete({ where: { id: ctx.params.id } });
  return ctx.json({ deleted: true });
};
