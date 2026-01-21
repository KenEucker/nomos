import type { Ctx } from "../../platform/ctx";
import { HttpError } from "../../platform/errors";
import { defineRoute } from "../../platform/router/defineRoute";
import { uploadsContract } from "./uploads.contract";

export default defineRoute(uploadsContract, {
  auth: "none",
  operations: {
    put: {
      validate: {
        params: uploadsContract.schema.paramsKey,
        query: uploadsContract.schema.queryToken,
      },
      summary: "Upload file (signed URL)",
      handler: async (ctx: Ctx) => {
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
      },
    },
  },
});
