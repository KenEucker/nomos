import type { CapabilityMap, ClientAuthPayload, Decision } from "./types"
import type { Subject } from "../auth/subject"
import { toastError } from "../toast"

let cachedPayload: ClientAuthPayload | null | undefined

const readPayload = (): ClientAuthPayload | null => {
  if (cachedPayload !== undefined) return cachedPayload
  if (typeof window === "undefined") {
    cachedPayload = null
    return cachedPayload
  }

  const fromWindow = (window as Window & { __NOMOS_AUTH__?: ClientAuthPayload }).__NOMOS_AUTH__
  if (fromWindow) {
    cachedPayload = fromWindow
    return cachedPayload
  }

  const script = document.getElementById("nomos-auth")
  if (!script?.textContent) {
    cachedPayload = null
    return cachedPayload
  }

  try {
    cachedPayload = JSON.parse(script.textContent) as ClientAuthPayload
    return cachedPayload
  } catch {
    cachedPayload = null
    return cachedPayload
  }
}

export const getSubject = (): Subject | null => readPayload()?.subject ?? null

export const getCapabilities = (): CapabilityMap => readPayload()?.capabilities ?? {}

export const can = (intent: string): boolean => Boolean(getCapabilities()[intent])

const isAdmin = (subject: Subject | null) => subject?.level === "admin"

export const decide = (intent: string): Decision => {
  const allowed = can(intent)
  if (allowed) {
    return { intent, outcome: "allow", allowed: true }
  }

  const decision: Decision = {
    intent,
    outcome: "deny",
    allowed: false,
    reason: { code: "missing_intent", message: `Missing intent: ${intent}` },
    evidence: [{ kind: "capability", detail: "Intent not granted" }],
  }

  if (!isAdmin(getSubject())) {
    return { intent, outcome: decision.outcome, allowed: decision.allowed }
  }

  return decision
}

export const notifyDeny = (intent: string) => {
  const subject = getSubject()
  const decision = decide(intent)
  if (isAdmin(subject)) {
    toastError("Permission denied", decision.reason?.message ?? `Missing intent: ${intent}`)
    return
  }
  toastError("Permission denied", "You don’t have permission to do that.")
}
