import { createHash } from "node:crypto";

export function createApiRevision(spec: unknown) {
  const payload = JSON.stringify(spec ?? {});
  return createHash("sha256").update(payload).digest("hex");
}
