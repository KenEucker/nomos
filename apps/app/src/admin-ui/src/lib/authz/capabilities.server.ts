import type { Subject, SubjectLevel } from "../auth/subject"
import type { CapabilityMap, Decision } from "./types"
import { INTENTS, type Intent } from "./intents"

const INTENTS_BY_LEVEL: Record<SubjectLevel, Intent[]> = {
  viewer: ["admin.access", "roles.read", "permissions.read", "subjects.read"],
  manager: [
    "admin.access",
    "roles.read",
    "roles.update",
    "permissions.read",
    "subjects.read",
    "subjects.update",
  ],
  admin: [...INTENTS],
}

export const computeCapabilities = (subject: Subject | null): CapabilityMap => {
  const allowed = new Set(subject ? INTENTS_BY_LEVEL[subject.level] : [])
  return INTENTS.reduce<CapabilityMap>((acc, intent) => {
    acc[intent] = allowed.has(intent)
    return acc
  }, {})
}

export const can = (subject: Subject | null, intent: string): boolean => {
  const capabilities = computeCapabilities(subject)
  return Boolean(capabilities[intent])
}

export const decide = (subject: Subject | null, intent: string): Decision => {
  const allowed = can(subject, intent)
  if (allowed) {
    return {
      intent,
      outcome: "allow",
      allowed: true,
    }
  }

  return {
    intent,
    outcome: "deny",
    allowed: false,
    reason: {
      code: "missing_intent",
      message: `Missing intent: ${intent}`,
    },
    evidence: [{ kind: "capability", detail: "Intent not granted" }],
  }
}
