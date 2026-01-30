import { z } from "zod";
import { defineContract } from "../../platform/router/contract";
import { paginationQuery } from "../../platform/validation";

/**
 * Roles API Contract
 *
 * Defines the API contract for role management endpoints.
 */
export const rolesContract = defineContract({
  id: "roles",
  tags: ["Roles"],
  description: "Role management API",
  intents: {
    list: true,   // roles.list
    read: true,   // roles.read
    create: true, // roles.create
    update: true, // roles.update
    delete: true, // roles.delete
  },
  schema: {
    paramsId: z.object({
      id: z.string(),
    }),

    queryList: paginationQuery.extend({
      search: z.string().optional(),
      sort: z.string().optional(),
    }),

    createBody: z.object({
      key: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, "Key must be lowercase with underscores"),
      name: z.string().min(1),
      permissions: z.array(z.string()).optional(),
    }),

    updateBody: z.object({
      name: z.string().min(1).optional(),
      permissions: z.array(z.string()).optional(),
      // Note: key is not editable after creation
    }),

    entity: z.object({
      id: z.string(),
      key: z.string(),
      name: z.string(),
      userCount: z.number().optional(),
      permissionKeys: z.array(z.string()).optional(),
    }),

    listResponse: z.object({
      roles: z.array(z.object({
        id: z.string(),
        key: z.string(),
        name: z.string(),
        userCount: z.number(),
        permissionKeys: z.array(z.string()).optional(),
      })),
    }),
  },
});
