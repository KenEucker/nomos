import { z } from "zod";
import type { Ctx } from "../../../../platform/ctx";
import { HttpError } from "../../../../platform/errors";
import { modelSchemas, okResponse } from "../../_openapi";
import { serializeComment } from "../../_serializers";

const paramsSchema = z.object({ taskId: z.string() });
const createSchema = z.object({ body: z.string().min(1) });

export const config = {
  auth: "required",
  roles: ["viewer", "editor", "admin"],
  tags: ["Comments"],
  summary: "List task comments",
  validate: { params: paramsSchema },
  openapi: {
    components: { schemas: modelSchemas },
    operation: {
      responses: {
        200: {
          description: "Comments",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: {
                  comments: { type: "array", items: { $ref: "#/components/schemas/Comment" } }
                },
                required: ["comments"]
              })
            }
          }
        }
      }
    }
  }
};

export const get = async (ctx: Ctx) => {
  const comments = await ctx.prisma.comment.findMany({
    where: { taskId: ctx.params.taskId },
    orderBy: { createdAt: "asc" }
  });
  return ctx.json({ comments: comments.map(serializeComment) });
};

export const postConfig = {
  auth: "required",
  roles: ["editor", "admin"],
  validate: { params: paramsSchema, body: createSchema },
  openapi: {
    components: { schemas: modelSchemas },
    operation: {
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { body: { type: "string" } },
              required: ["body"]
            }
          }
        }
      },
      responses: {
        201: {
          description: "Created comment",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: { comment: { $ref: "#/components/schemas/Comment" } },
                required: ["comment"]
              })
            }
          }
        }
      }
    }
  }
};

export const post = async (ctx: Ctx) => {
  if (!ctx.user) {
    throw new HttpError(401, "unauthorized", "Authentication required");
  }
  const task = await ctx.prisma.task.findUnique({ where: { id: ctx.params.taskId } });
  if (!task) {
    throw new HttpError(404, "not_found", "Task not found");
  }
  const comment = await ctx.prisma.comment.create({
    data: {
      taskId: ctx.params.taskId,
      body: ctx.body.body,
      authorUserId: ctx.user.id
    }
  });
  return ctx.json({ comment: serializeComment(comment) }, 201);
};
