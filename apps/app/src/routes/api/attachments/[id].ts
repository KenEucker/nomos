import { z } from "zod";
import type { Ctx } from "../../../platform/ctx";
import { HttpError } from "../../../platform/errors";
import { okResponse } from "../_openapi";

const paramsSchema = z.object({ id: z.string() });

export const config = {
  auth: "required",
  roles: ["editor", "admin"],
  tags: ["Attachments"],
  summary: "Delete attachment",
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
  const attachment = await ctx.prisma.attachment.findUnique({ where: { id: ctx.params.id } });
  if (!attachment) {
    throw new HttpError(404, "not_found", "Attachment not found");
  }
  await ctx.prisma.attachment.delete({ where: { id: attachment.id } });
  await ctx.services.storage.delete(attachment.key);
  return ctx.json({ deleted: true });
};
