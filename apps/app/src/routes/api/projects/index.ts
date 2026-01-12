import { z } from "zod";
import type { Ctx } from "../../../platform/ctx.js";
import { paginationQuery, parseSort } from "../../../platform/validation.js";
import { HttpError } from "../../../platform/errors.js";
import { modelSchemas, okResponse } from "../_openapi.js";
import { serializeProject } from "../_serializers.js";

const querySchema = paginationQuery.extend({
  search: z.string().optional(),
  sort: z.string().optional()
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional()
});

export const config = {
  auth: "required",
  roles: ["viewer", "editor", "admin"],
  tags: ["Projects"],
  summary: "List projects",
  validate: { query: querySchema },
  openapi: {
    components: { schemas: modelSchemas },
    operation: {
      parameters: [
        { name: "search", in: "query", schema: { type: "string" } },
        { name: "page", in: "query", schema: { type: "integer" } },
        { name: "pageSize", in: "query", schema: { type: "integer" } },
        { name: "sort", in: "query", schema: { type: "string" } }
      ],
      responses: {
        200: {
          description: "Projects",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: {
                  projects: { type: "array", items: { $ref: "#/components/schemas/Project" } }
                },
                required: ["projects"]
              }, true)
            }
          }
        }
      }
    }
  }
};

export const get = async (ctx: Ctx) => {
  const { page, pageSize, search, sort } = ctx.query;
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } }
        ]
      }
    : undefined;
  const sortConfig = parseSort(sort, ["createdAt", "name"]);

  const [total, projects] = await Promise.all([
    ctx.prisma.project.count({ where }),
    ctx.prisma.project.findMany({
      where,
      orderBy: sortConfig ? { [sortConfig.field]: sortConfig.order } : { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return ctx.json(
    { projects: projects.map(serializeProject) },
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
                name: { type: "string" },
                description: { type: "string" }
              },
              required: ["name"]
            }
          }
        }
      },
      responses: {
        201: {
          description: "Created project",
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

export const post = async (ctx: Ctx) => {
  if (!ctx.user) {
    throw new HttpError(401, "unauthorized", "Authentication required");
  }
  const project = await ctx.prisma.project.create({
    data: {
      name: ctx.body.name,
      description: ctx.body.description,
      createdByUserId: ctx.user.id
    }
  });
  return ctx.json({ project: serializeProject(project) }, 201);
};
