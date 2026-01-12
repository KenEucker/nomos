import { z } from "zod";
import type { Ctx } from "../../../../../platform/ctx";
import { modelSchemas, okResponse } from "../../../_openapi";
import { serializeAttachment } from "../../../_serializers";

const paramsSchema = z.object({ taskId: z.string() });

export const config = {
  auth: "required",
  roles: ["viewer", "editor", "admin"],
  tags: ["Attachments"],
  summary: "List task attachments",
  validate: { params: paramsSchema },
  openapi: {
    components: { schemas: modelSchemas },
    operation: {
      responses: {
        200: {
          description: "Attachments",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: {
                  attachments: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Attachment" }
                  }
                },
                required: ["attachments"]
              })
            }
          }
        }
      }
    }
  }
};

export const get = async (ctx: Ctx) => {
  const attachments = await ctx.prisma.attachment.findMany({
    where: { taskId: ctx.params.taskId },
    orderBy: { createdAt: "desc" }
  });
  return ctx.json({ attachments: attachments.map(serializeAttachment) });
};
