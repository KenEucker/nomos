export const INTENTS = [
  "admin.access",
  "roles.read",
  "roles.create",
  "roles.update",
  "roles.delete",
  "permissions.read",
  "permissions.update",
  "subjects.read",
  "subjects.create",
  "subjects.update",
  "subjects.delete",
  "debug.decisions.view",
] as const

export type Intent = (typeof INTENTS)[number]
