import { z } from "zod";
import { defineContract } from "../../../platform/router/contract";
import { paginationQuery } from "../../../platform/validation";

/**
 * Users API Contract
 *
 * Defines the API contract for user management endpoints.
 */
export const usersContract = defineContract({
  id: "users",
  tags: ["Users"],
  description: "User management API",
  intents: {
    list: true,   // users.list
    read: true,   // users.read
    create: true, // users.create
    update: true, // users.update
    delete: true, // users.delete
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
      email: z.string().email(),
      name: z.string().min(1),
      password: z.string().min(6),
      roles: z.array(z.string()).optional(),
    }),

    updateBody: z.object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      password: z.string().min(6).optional(),
      roles: z.array(z.string()).optional(),
    }),

    rolesBody: z.object({
      roles: z.array(z.string()),
    }),

    entity: z.object({
      id: z.string(),
      email: z.string(),
      name: z.string(),
      roles: z.array(z.string()),
      createdAt: z.string(),
    }),

    listResponse: z.object({
      users: z.array(z.object({
        id: z.string(),
        email: z.string(),
        name: z.string(),
        roles: z.array(z.string()),
        createdAt: z.string(),
      })),
    }),
  },
});

/**
 * Admin Users Contract
 *
 * Defines the API contract for admin user endpoints.
 */
export const adminUsersContract = defineContract({
  id: "admin.users",
  tags: ["admin"],
  description: "Admin user management API",
  intents: {
    list: "users.read",
    read: "users.read",
    create: "users.create",
    update: false,
    delete: false,
  },
  schema: {
    createBody: z.object({
      name: z.string(),
      email: z.string().email(),
      roles: z.array(z.string()).optional(),
    }),
  },
});

/**
 * Admin Roles Contract
 *
 * Defines the API contract for admin role endpoints.
 */
export const adminRolesContract = defineContract({
  id: "admin.roles",
  tags: ["admin"],
  description: "Admin role management API",
  intents: {
    list: "roles.manage",
    read: false,
    create: "roles.manage",
    update: false,
    delete: false,
  },
  schema: {
    createBody: z.object({
      name: z.string(),
      permissions: z.array(z.string()),
    }),
  },
});
