export type PermissionSeed = {
  id: string
  name: string
  description: string
}

export const PERMISSIONS: PermissionSeed[] = [
  { id: "admin.access", name: "Admin: Access", description: "Access the admin console." },
  { id: "roles.read", name: "Roles: Read", description: "View role definitions." },
  { id: "roles.create", name: "Roles: Create", description: "Create new roles." },
  { id: "roles.update", name: "Roles: Update", description: "Edit role details." },
  { id: "roles.delete", name: "Roles: Delete", description: "Remove roles." },
  {
    id: "permissions.read",
    name: "Permissions: Read",
    description: "View available permissions.",
  },
  {
    id: "permissions.update",
    name: "Permissions: Update",
    description: "Create and edit permissions.",
  },
  { id: "subjects.read", name: "Subjects: Read", description: "View subjects and identities." },
  { id: "subjects.create", name: "Subjects: Create", description: "Add new subjects." },
  { id: "subjects.update", name: "Subjects: Update", description: "Edit subject assignments." },
  { id: "subjects.delete", name: "Subjects: Delete", description: "Remove subjects." },
  {
    id: "debug.decisions.view",
    name: "Decisions: Debug",
    description: "View authorization decision details.",
  },
]
