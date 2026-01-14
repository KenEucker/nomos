import { z } from "zod";
import type { Ctx } from "../../platform/ctx";
import { HttpError } from "../../platform/errors";
import { paginationQuery, parseSort } from "../../platform/validation";
import { modelSchemas, okResponse } from "../_openapi";

const querySchema = paginationQuery.extend({
  search: z.string().optional(),
  sort: z.string().optional()
});

const createSchema = z.object({
  key: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, "Key must be lowercase with underscores"),
  name: z.string().min(1)
});

export const config = {
  auth: "required",
  tags: ["Roles"],
  summary: "List roles",
  roles: ["admin"],
  validate: { query: querySchema },
  openapi: {
    components: { schemas: modelSchemas },
    operation: {
      parameters: [
        { name: "search", in: "query", schema: { type: "string" } },
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        { name: "sort", in: "query", schema: { type: "string", example: "key:asc" } }
      ],
      responses: {
        200: {
          description: "Roles",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: {
                  roles: { type: "array", items: { $ref: "#/components/schemas/Role" } }
                },
                required: ["roles"]
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
          { key: { contains: search } },
          { name: { contains: search } }
        ]
      }
    : undefined;

  const sortConfig = parseSort(sort, ["key", "name"]);
  const [total, roles] = await Promise.all([
    ctx.prisma.role.count({ where }),
    ctx.prisma.role.findMany({
      where,
      include: { users: true },
      orderBy: sortConfig ? { [sortConfig.field]: sortConfig.order } : { key: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  // Add user count to each role
  const rolesWithCount = roles.map((role) => ({
    id: role.id,
    key: role.key,
    name: role.name,
    userCount: role.users.length
  }));

  return ctx.json(
    { roles: rolesWithCount },
    200,
    { page, pageSize, total }
  );
};

export const postConfig = {
  auth: "required",
  roles: ["admin"],
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
                key: { type: "string" },
                name: { type: "string" }
              },
              required: ["key", "name"]
            }
          }
        }
      },
      responses: {
        201: {
          description: "Created role",
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

export const post = async (ctx: Ctx) => {
  const { key, name } = ctx.body;

  // Check if role key already exists
  const existing = await ctx.prisma.role.findUnique({ where: { key } });
  if (existing) {
    throw new HttpError(409, "conflict", "Role key already exists");
  }

  const created = await ctx.prisma.role.create({
    data: { key, name }
  });

  return ctx.json({ role: created }, 201);
};
