import crypto from "node:crypto";

export function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function compareHash(value: string, hash: string) {
  return hashValue(value) === hash;
}
