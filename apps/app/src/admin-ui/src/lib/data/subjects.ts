export type SubjectSeed = {
  id: string
  name: string
  email: string
  level: "viewer" | "manager" | "admin"
  roles: string[]
}

export const SUBJECTS: SubjectSeed[] = [
  {
    id: "subject-viewer",
    name: "Violet Viewer",
    email: "viewer@nomos.dev",
    level: "viewer",
    roles: ["role-viewer"],
  },
  {
    id: "subject-manager",
    name: "Manny Manager",
    email: "manager@nomos.dev",
    level: "manager",
    roles: ["role-manager"],
  },
  {
    id: "subject-admin",
    name: "Ada Admin",
    email: "admin@nomos.dev",
    level: "admin",
    roles: ["role-admin"],
  },
]
