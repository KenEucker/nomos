import { z } from "zod";
import type { Ctx } from "../../../platform/ctx";
import { HttpError } from "../../../platform/errors";
import { okResponse } from "../_openapi";

const paramsSchema = z.object({ key: z.string() });
const querySchema = z.object({ token: z.string() });

export const config = {
  auth: "none",
  tags: ["Attachments"],
  summary: "Upload file (signed URL)",
  validate: { params: paramsSchema, query: querySchema },
  openapi: {
    operation: {
      parameters: [
        { name: "token", in: "query", required: true, schema: { type: "string" } }
      ],
      responses: {
        200: {
          description: "Uploaded",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: { uploaded: { type: "boolean", const: true } },
                required: ["uploaded"]
              })
            }
          }
        }
      }
    }
  }
};

export const put = async (ctx: Ctx) => {
  const entry = ctx.services.storage.verifyPut(ctx.query.token, ctx.params.key);
  if (!entry) {
    throw new HttpError(403, "forbidden", "Invalid or expired upload token");
  }
  const chunks: Buffer[] = [];
  for await (const chunk of ctx.req.raw) {
    chunks.push(chunk as Buffer);
  }
  const buffer = Buffer.concat(chunks);
  if (buffer.length !== entry.sizeBytes) {
    throw new HttpError(400, "invalid_upload", "Uploaded size does not match signed size");
  }
  await ctx.services.storage.writeFile(ctx.params.key, buffer);
  ctx.services.storage.finalize(ctx.query.token);
  return ctx.json({ uploaded: true });
};
