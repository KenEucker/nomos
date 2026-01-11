import crypto from "node:crypto";

export function signPayload(secret: string, payload: string, timestamp: string) {
  const data = `${timestamp}.${payload}`;
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

export function buildSignature(secret: string, payload: string) {
  const timestamp = Date.now().toString();
  const signature = signPayload(secret, payload, timestamp);
  return { timestamp, signature };
}

export function verifySignature(secret: string, payload: string, timestamp: string, signature: string) {
  const expected = signPayload(secret, payload, timestamp);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
