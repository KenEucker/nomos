import type { User, UserRole } from "@prisma/client";

type UserWithRoles = User & { roles: Array<UserRole & { role: { key: string; name: string } }> };

export function serializeUser(user: UserWithRoles) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles.map((role) => role.role.key),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}
