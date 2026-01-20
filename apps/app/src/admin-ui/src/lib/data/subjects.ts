export type SubjectSeed = {
  id: string
  name: string
  email: string
  level: "viewer" | "manager" | "admin"
  roles?: string[]
}

export const SUBJECTS: SubjectSeed[] = [
  {
    id: "viewer",
    name: "Viewer",
    email: "viewer@nomos.local",
    level: "viewer",
    roles: ["viewer"],
  },
  {
    id: "manager",
    name: "Manager",
    email: "manager@nomos.local",
    level: "manager",
    roles: ["manager"],
  },
  {
    id: "admin",
    name: "Admin",
    email: "admin@nomos.local",
    level: "admin",
    roles: ["admin"],
  },
]
