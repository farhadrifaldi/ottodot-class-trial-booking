import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword, SESSION_COOKIE_NAME } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/api";
import type { Role } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(422, "invalid_request");
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });

  // Deliberately generic on both "no such email" and "wrong password" so this
  // endpoint can't be used to enumerate registered emails (TECH_DESIGN.md §2).
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return errorResponse(401, "invalid_credentials");
  }

  const { token, expiresAt } = await createSession(user.id);

  const response = NextResponse.json({ ok: true, role: user.role as Role });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return response;
}
