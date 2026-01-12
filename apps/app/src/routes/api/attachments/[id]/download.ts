import { z } from "zod";
import type { Ctx } from "../../../../platform/ctx";
import { HttpError } from "../../../../platform/errors";

const paramsSchema = z.object({ id: z.string() });

export const config = {
  auth: "required",
  roles: ["viewer", "editor", "admin"],
  tags: ["Attachments"],
  summary: "Download attachment",
  validate: { params: paramsSchema }
};

export const get = async (ctx: Ctx) => {
  const attachment = await ctx.prisma.attachment.findUnique({ where: { id: ctx.params.id } });
  if (!attachment) {
    throw new HttpError(404, "not_found", "Attachment not found");
  }
  try {
    const file = await ctx.services.storage.readFile(attachment.key);
    ctx.reply.header("content-type", attachment.contentType);
    ctx.reply.header("content-disposition", `attachment; filename="${attachment.filename}"`);
    ctx.reply.send(file);
  } catch {
    throw new HttpError(404, "not_found", "File not found");
  }
};
