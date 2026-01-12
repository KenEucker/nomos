import { z } from "zod";
import { nanoid } from "nanoid";
import type { Ctx } from "../../../../../platform/ctx";
import { HttpError } from "../../../../../platform/errors";
import { okResponse } from "../../../_openapi";

const paramsSchema = z.object({ taskId: z.string() });
const bodySchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.coerce.number().int().min(1).max(50 * 1024 * 1024)
});

export const config = {
  auth: "required",
  roles: ["editor", "admin"],
  tags: ["Attachments"],
  summary: "Sign attachment upload",
  validate: { params: paramsSchema, body: bodySchema },
  openapi: {
    operation: {
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                filename: { type: "string" },
                contentType: { type: "string" },
                sizeBytes: { type: "integer" }
              },
              required: ["filename", "contentType", "sizeBytes"]
            }
          }
        }
      },
      responses: {
        200: {
          description: "Signed upload",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: {
                  uploadUrl: { type: "string" },
                  key: { type: "string" },
                  headersToInclude: { type: "object", additionalProperties: { type: "string" } }
                },
                required: ["uploadUrl", "key"]
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
  const safeName = ctx.body.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `tasks/${ctx.params.taskId}/${nanoid()}-${safeName}`;
  const signed = ctx.services.storage.signPut({
    key,
    contentType: ctx.body.contentType,
    sizeBytes: ctx.body.sizeBytes
  });
  return ctx.json(signed);
};
