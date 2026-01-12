import { z } from "zod";
import type { Ctx } from "../../../platform/ctx";
import { HttpError } from "../../../platform/errors";
import { okResponse } from "../_openapi";

const paramsSchema = z.object({ id: z.string() });

export const config = {
  auth: "required",
  roles: ["editor", "admin"],
  tags: ["Comments"],
  summary: "Delete comment",
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
  if (!ctx.user) {
    throw new HttpError(401, "unauthorized", "Authentication required");
  }
  const comment = await ctx.prisma.comment.findUnique({ where: { id: ctx.params.id } });
  if (!comment) {
    throw new HttpError(404, "not_found", "Comment not found");
  }
  const isAdmin = ctx.user.roles.includes("admin");
  if (!isAdmin && comment.authorUserId !== ctx.user.id) {
    throw new HttpError(403, "forbidden", "Only authors or admins can delete comments");
  }
  await ctx.prisma.comment.delete({ where: { id: ctx.params.id } });
  return ctx.json({ deleted: true });
};
