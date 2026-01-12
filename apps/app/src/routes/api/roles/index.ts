import type { Ctx } from "../../../platform/ctx.js";
import { modelSchemas, okResponse } from "../_openapi.js";

export const config = {
  auth: "required",
  tags: ["Roles"],
  summary: "List roles",
  roles: ["admin"],
  openapi: {
    components: { schemas: modelSchemas },
    operation: {
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
              })
            }
          }
        }
      }
    }
  }
};

export const get = async (ctx: Ctx) => {
  const roles = await ctx.prisma.role.findMany({ orderBy: { key: "asc" } });
  return ctx.json({ roles });
};
