import { PERMISSIONS } from "./permissions"

export type RoleSeed = {
  id: string
  name: string
  description: string
  permissions: string[]
}

const allPermissions = PERMISSIONS.map((permission) => permission.id)

export const ROLES: RoleSeed[] = [
  {
    id: "role-admin",
    name: "Admin",
    description: "Full access to every resource.",
    permissions: allPermissions,
  },
  {
    id: "role-manager",
    name: "Manager",
    description: "Manage roles and subjects without full admin scope.",
    permissions: [
      "admin.access",
      "roles.read",
      "roles.update",
      "permissions.read",
      "subjects.read",
      "subjects.update",
    ],
  },
  {
    id: "role-viewer",
    name: "Viewer",
    description: "Read-only access for audits and reviews.",
    permissions: ["admin.access", "roles.read", "permissions.read", "subjects.read"],
  },
]
