import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Ctx } from "../../../platform/ctx";
import { HttpError } from "../../../platform/errors";
import { paginationQuery, parseSort } from "../../../platform/validation";
import { modelSchemas, okResponse } from "../_openapi";
import { serializeUser } from "../_serializers";

const querySchema = paginationQuery.extend({
  search: z.string().optional(),
  sort: z.string().optional()
});

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  roles: z.array(z.string()).optional()
});

export const config = {
  auth: "required",
  roles: ["admin"],
  tags: ["Users"],
  summary: "List users",
  validate: { query: querySchema },
  openapi: {
    components: { schemas: modelSchemas },
    operation: {
      parameters: [
        { name: "search", in: "query", schema: { type: "string" } },
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        { name: "sort", in: "query", schema: { type: "string", example: "createdAt:desc" } }
      ],
      responses: {
        200: {
          description: "Users",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: {
                  users: { type: "array", items: { $ref: "#/components/schemas/User" } }
                },
                required: ["users"]
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
          { email: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } }
        ]
      }
    : undefined;

  const sortConfig = parseSort(sort, ["createdAt", "email", "name"]);
  const [total, users] = await Promise.all([
    ctx.prisma.user.count({ where }),
    ctx.prisma.user.findMany({
      where,
      include: { roles: { include: { role: true } } },
      orderBy: sortConfig ? { [sortConfig.field]: sortConfig.order } : { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return ctx.json(
    { users: users.map(serializeUser) },
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
                email: { type: "string", format: "email" },
                name: { type: "string" },
                password: { type: "string" },
                roles: { type: "array", items: { type: "string" } }
              },
              required: ["email", "name", "password"]
            }
          }
        }
      },
      responses: {
        201: {
          description: "Created user",
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

export const post = async (ctx: Ctx) => {
  const { email, name, password, roles } = ctx.body;
  const existing = await ctx.prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, "conflict", "Email already exists");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const created = await ctx.prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      roles: roles?.length
        ? {
            create: roles.map((roleKey: string) => ({
              role: { connect: { key: roleKey } }
            }))
          }
        : undefined
    },
    include: { roles: { include: { role: true } } }
  });
  return ctx.json({ user: serializeUser(created) }, 201);
};
