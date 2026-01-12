import { z } from "zod";
import type { Ctx } from "../../../../../platform/ctx";
import { HttpError } from "../../../../../platform/errors";
import { modelSchemas, okResponse } from "../../../_openapi";
import { serializeAttachment } from "../../../_serializers";

const paramsSchema = z.object({ taskId: z.string() });
const bodySchema = z.object({
  key: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.coerce.number().int().min(1)
});

export const config = {
  auth: "required",
  roles: ["editor", "admin"],
  tags: ["Attachments"],
  summary: "Confirm attachment upload",
  validate: { params: paramsSchema, body: bodySchema },
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
                filename: { type: "string" },
                contentType: { type: "string" },
                sizeBytes: { type: "integer" }
              },
              required: ["key", "filename", "contentType", "sizeBytes"]
            }
          }
        }
      },
      responses: {
        200: {
          description: "Created attachment",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: { attachment: { $ref: "#/components/schemas/Attachment" } },
                required: ["attachment"]
              })
            }
          }
        }
      }
    }
  }
};

export const post = async (ctx: Ctx) => {
  const task = await ctx.prisma.task.findUnique({ where: { id: ctx.params.taskId } });
  if (!task) {
    throw new HttpError(404, "not_found", "Task not found");
  }
  if (!ctx.services.storage.exists(ctx.body.key)) {
    throw new HttpError(400, "invalid_upload", "Upload not found for key");
  }
  const attachment = await ctx.prisma.attachment.create({
    data: {
      taskId: ctx.params.taskId,
      key: ctx.body.key,
      filename: ctx.body.filename,
      contentType: ctx.body.contentType,
      sizeBytes: ctx.body.sizeBytes
    }
  });
  return ctx.json({ attachment: serializeAttachment(attachment) });
};
