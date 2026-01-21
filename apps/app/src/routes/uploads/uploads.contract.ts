import { z } from "zod";
import { defineContract } from "../../platform/router/contract";

/**
 * Uploads API Contract
 *
 * Defines the API contract for file upload endpoints with signed URLs.
 */
export const uploadsContract = defineContract({
  id: "uploads",
  tags: ["Uploads"],
  description: "File upload API with signed URLs",
  intents: {
    // Uploads are authenticated via signed tokens, not user intents
    list: false,
    read: false,
    create: false,
    update: false,
    delete: false,
  },
  schema: {
    paramsKey: z.object({
      key: z.string(),
    }),

    queryToken: z.object({
      token: z.string(),
    }),

    uploadResponse: z.object({
      uploaded: z.literal(true),
    }),
  },
});
