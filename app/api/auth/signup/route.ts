import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { signupSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/api";

// Registration only creates the account — it does NOT create a session.
// A separate POST /api/auth/login call is required afterward (TECH_DESIGN.md §2).
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(422, "invalid_request");
  }
  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return errorResponse(409, "email_taken");
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "PARENT",
      parent: { create: { name } },
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
