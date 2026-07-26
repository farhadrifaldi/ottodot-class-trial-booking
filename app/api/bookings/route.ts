import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { createBookingSchema } from "@/lib/validation";
import { TRIAL_SEAT_CAP } from "@/lib/types";

// Lists every booking (any status) for the logged-in parent's own children —
// "which classes has my family already booked and paid for". Scoped entirely
// by session, same IDOR fix as everywhere else (TECH_DESIGN.md §2): there is
// no way to pass another parent's id in and see their bookings.
export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return errorResponse(401, "unauthorized");
  }
  if (sessionUser.role !== "PARENT" || !sessionUser.parentId) {
    return errorResponse(403, "forbidden");
  }

  const bookings = await prisma.booking.findMany({
    where: { student: { parentId: sessionUser.parentId } },
    include: { student: true, classData: true },
    orderBy: { createdAt: "desc" },
  });

  const results = bookings.map((b) => ({
    id: b.id,
    status: b.status,
    failureReason: b.failureReason,
    cancellationReason: b.cancellationReason,
    createdAt: b.createdAt,
    student: { id: b.student.id, name: b.student.name },
    classData: {
      id: b.classData.id,
      subject: b.classData.subject,
      startsAt: b.classData.startsAt,
    },
  }));

  return NextResponse.json(results);
}

// Order of checks matters and mirrors TECH_DESIGN.md §4-§5: ownership, trial
// eligibility, duplicate-booking, then the optimistic (non-authoritative)
// capacity pre-check. The authoritative capacity check happens later, at
// payment confirmation (see app/api/bookings/[id]/pay/route.ts).
export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return errorResponse(401, "unauthorized");
  }
  if (sessionUser.role !== "PARENT" || !sessionUser.parentId) {
    return errorResponse(403, "forbidden");
  }

  const body = await request.json().catch(() => null);
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(422, "invalid_request");
  }
  const { studentId, classId } = parsed.data;

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) {
    return errorResponse(404, "not_found");
  }
  if (student.parentId !== sessionUser.parentId) {
    return errorResponse(403, "forbidden");
  }

  const classData = await prisma.classData.findUnique({ where: { id: classId } });
  if (!classData) {
    return errorResponse(404, "not_found");
  }
  if (!classData.isTrial) {
    return errorResponse(422, "not_a_trial_class");
  }

  const existing = await prisma.booking.findFirst({
    where: { studentId, classId },
    orderBy: { createdAt: "desc" },
  });

  if (existing?.status === "confirmed") {
    return errorResponse(409, "already_booked");
  }
  if (existing?.status === "pending_payment") {
    // Idempotent: same student+class pending booking already exists.
    return NextResponse.json(existing, { status: 201 });
  }

  // Step A: optimistic pre-check only (UX fast-fail). Deliberately counts
  // only `confirmed` bookings, not other pending holds — see TECH_DESIGN.md §5
  // for why that's required for the last-seat race to even be reachable.
  const confirmedCount = await prisma.booking.count({
    where: { classId, status: "confirmed" },
  });
  if (confirmedCount >= TRIAL_SEAT_CAP) {
    return errorResponse(409, "class_full");
  }

  const booking = await prisma.booking.create({
    data: { studentId, classId, status: "pending_payment" },
  });

  return NextResponse.json(booking, { status: 201 });
}
