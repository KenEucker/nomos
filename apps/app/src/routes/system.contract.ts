import { z } from "zod";
import { defineContract } from "../platform/router/contract";

/**
 * System API Contract
 *
 * Defines the API contract for system endpoints (health, version, ready).
 * These are public endpoints that don't require authentication.
 */
export const systemContract = defineContract({
  id: "system",
  tags: ["System"],
  description: "System health and status endpoints",
  intents: {
    // System routes are public, no intents required
    list: false,
    read: false,
    create: false,
    update: false,
    delete: false,
  },
  schema: {
    healthResponse: z.object({
      status: z.literal("ok"),
    }),

    versionResponse: z.object({
      name: z.string(),
      version: z.string(),
      platformVersion: z.string(),
      apiVersion: z.string(),
      apiRevision: z.string(),
      build: z.string(),
    }),

    readyResponse: z.object({
      status: z.literal("ok"),
      database: z.string(),
      queue: z.string(),
    }),
  },
});
