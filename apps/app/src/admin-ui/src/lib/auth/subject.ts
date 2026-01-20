import { SUBJECTS as SUBJECT_SEEDS } from "../data/subjects"

export type SubjectLevel = "viewer" | "manager" | "admin"

export type Subject = {
  id: string
  name: string
  email: string
  level: SubjectLevel
  roles?: string[]
}

export const SUBJECT_COOKIE = "nomos-subject"

export const SUBJECTS: Subject[] = SUBJECT_SEEDS.map((subject) => ({ ...subject }))

export const resolveSubject = (key?: string | null) => {
  if (!key) return null
  return SUBJECTS.find((subject) => subject.id === key || subject.level === key) ?? null
}

export const isAdminSubject = (subject: Subject | null | undefined) => subject?.level === "admin"
