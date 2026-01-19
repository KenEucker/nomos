import type { Subject } from "../auth/subject"

export type CapabilityMap = Record<string, boolean>

export type Decision = {
  intent: string
  outcome: "allow" | "deny" | "abstain"
  allowed: boolean
  reason?: { code: string; message: string }
  evidence?: Array<{ kind: string; detail?: string }>
}

export type ClientAuthPayload = {
  capabilities: CapabilityMap
  subject: Subject | null
}
