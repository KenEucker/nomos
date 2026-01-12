import { z } from "zod";
import type { Ctx } from "../../../platform/ctx";
import { paginationQuery } from "../../../platform/validation";
import { HttpError } from "../../../platform/errors";
import { modelSchemas, okResponse } from "../_openapi";
import { serializeTask } from "../_serializers";

const querySchema = paginationQuery.extend({
  projectId: z.string().optional(),
  status: z.enum(["todo", "doing", "done"]).optional(),
  assignedToUserId: z.string().optional(),
  search: z.string().optional()
});

const createSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["todo", "doing", "done"]).optional(),
  assignedToUserId: z.string().optional().nullable()
});

export const config = {
  auth: "required",
  roles: ["viewer", "editor", "admin"],
  tags: ["Tasks"],
  summary: "List tasks",
  validate: { query: querySchema },
  openapi: {
    components: { schemas: modelSchemas },
    operation: {
      parameters: [
        { name: "projectId", in: "query", schema: { type: "string" } },
        { name: "status", in: "query", schema: { type: "string", enum: ["todo", "doing", "done"] } },
        { name: "assignedToUserId", in: "query", schema: { type: "string" } },
        { name: "search", in: "query", schema: { type: "string" } },
        { name: "page", in: "query", schema: { type: "integer" } },
        { name: "pageSize", in: "query", schema: { type: "integer" } }
      ],
      responses: {
        200: {
          description: "Tasks",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: {
                  tasks: { type: "array", items: { $ref: "#/components/schemas/Task" } }
                },
                required: ["tasks"]
              }, true)
            }
          }
        }
      }
    }
  }
};

export const get = async (ctx: Ctx) => {
  const { page, pageSize, projectId, status, assignedToUserId, search } = ctx.query;
  const where = {
    ...(projectId ? { projectId } : {}),
    ...(status ? { status } : {}),
    ...(assignedToUserId ? { assignedToUserId } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const [total, tasks] = await Promise.all([
    ctx.prisma.task.count({ where }),
    ctx.prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return ctx.json(
    { tasks: tasks.map(serializeTask) },
    200,
    { page, pageSize, total }
  );
};

export const postConfig = {
  auth: "required",
  roles: ["editor", "admin"],
  validate: { body: createSchema },
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
                projectId: { type: "string" },
                title: { type: "string" },
                description: { type: "string" },
                status: { type: "string", enum: ["todo", "doing", "done"] },
                assignedToUserId: { type: "string", nullable: true }
              },
              required: ["projectId", "title"]
            }
          }
        }
      },
      responses: {
        201: {
          description: "Created task",
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

export const post = async (ctx: Ctx) => {
  const project = await ctx.prisma.project.findUnique({ where: { id: ctx.body.projectId } });
  if (!project) {
    throw new HttpError(404, "not_found", "Project not found");
  }
  const task = await ctx.prisma.task.create({
    data: {
      projectId: ctx.body.projectId,
      title: ctx.body.title,
      description: ctx.body.description,
      status: ctx.body.status ?? "todo",
      assignedToUserId: ctx.body.assignedToUserId ?? undefined
    }
  });
  return ctx.json({ task: serializeTask(task) }, 201);
};
