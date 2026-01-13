import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Ctx } from "../../platform/ctx";
import { createSession } from "../../platform/auth/sessions";
import { HttpError } from "../../platform/errors";
import { modelSchemas, okResponse } from "../_openapi";
import { serializeUser } from "../_serializers";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const config = {
  auth: "none",
  tags: ["Auth"],
  summary: "Login with email/password",
  validate: { body: bodySchema },
  openapi: {
    components: {
      schemas: modelSchemas
    },
    operation: {
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                email: { type: "string", format: "email", example: "admin@nomos.local" },
                password: { type: "string", example: "admin123" }
              },
              required: ["email", "password"]
            }
          }
        }
      },
      responses: {
        200: {
          description: "Authenticated",
          content: {
            "application/json": {
              schema: okResponse({
                type: "object",
                properties: { user: { $ref: "#/components/schemas/User" } },
                required: ["user"]
              })
            }
          }
        }
      }
    }
  }
};

export const post = async (ctx: Ctx) => {
  const { email, password } = ctx.body;
  const user = await ctx.prisma.user.findUnique({
    where: { email },
    include: { roles: { include: { role: true } } }
  });
  if (!user) {
    throw new HttpError(401, "invalid_credentials", "Invalid credentials");
  }
  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    throw new HttpError(401, "invalid_credentials", "Invalid credentials");
  }
  const sessionId = await createSession(ctx.prisma, user.id);
  ctx.reply.setCookie("session_id", sessionId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax"
  });
  return ctx.json({ user: serializeUser(user) });
};
