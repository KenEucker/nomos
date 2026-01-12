import { nanoid } from "nanoid";
import type { PrismaClient } from "@prisma/client";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export async function createSession(prisma: PrismaClient, userId: string) {
  const sessionId = nanoid();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      expiresAt
    }
  });
  return sessionId;
}

export async function getSession(prisma: PrismaClient, sessionId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: sessionId } });
    return null;
  }
  return session;
}

export async function revokeSession(prisma: PrismaClient, sessionId: string) {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}
