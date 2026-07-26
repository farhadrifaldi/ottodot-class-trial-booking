import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { createStudentSchema } from "@/lib/validation";

// No parentId query param — the parent is derived entirely from the session,
// never from client input. This is the fix for the IDOR gap in TECH_DESIGN.md §2.
export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return errorResponse(401, "unauthorized");
  }
  if (sessionUser.role !== "PARENT" || !sessionUser.parentId) {
    return errorResponse(403, "forbidden");
  }

  const students = await prisma.student.findMany({
    where: { parentId: sessionUser.parentId },
    select: { id: true, name: true },
  });

  return NextResponse.json(students);
}

// Lets a registered, logged-in parent add a child to their own account.
// Registration itself creates no students (seed data aside, a freshly
// registered parent has none) — this is the only way to get one, and it's
// scoped to the caller's own parentId, same as everywhere else.
export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return errorResponse(401, "unauthorized");
  }
  if (sessionUser.role !== "PARENT" || !sessionUser.parentId) {
    return errorResponse(403, "forbidden");
  }

  const body = await request.json().catch(() => null);
  const parsed = createStudentSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(422, "invalid_request");
  }

  const student = await prisma.student.create({
    data: { name: parsed.data.name, parentId: sessionUser.parentId },
    select: { id: true, name: true },
  });

  return NextResponse.json(student, { status: 201 });
}
