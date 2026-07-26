import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { TRIAL_SEAT_CAP } from "@/lib/types";

// Single-class detail, shown on the class detail page before a parent commits
// to booking (TECH_DESIGN.md's booking flow now goes list -> detail -> book,
// rather than booking directly from the list card).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return errorResponse(401, "unauthorized");
  }

  const { id } = await params;
  const classData = await prisma.classData.findUnique({ where: { id } });
  if (!classData) {
    return errorResponse(404, "not_found");
  }

  const confirmedCount = await prisma.booking.count({
    where: { classId: id, status: "confirmed" },
  });

  return NextResponse.json({
    id: classData.id,
    subject: classData.subject,
    description: classData.description,
    imageUrl: classData.imageUrl,
    startsAt: classData.startsAt,
    durationMinutes: classData.durationMinutes,
    isTrial: classData.isTrial,
    seatsAvailable: Math.max(0, TRIAL_SEAT_CAP - confirmedCount),
  });
}
