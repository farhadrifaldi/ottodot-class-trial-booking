import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return errorResponse(401, "unauthorized");
  }
  if (sessionUser.role !== "ADMIN") {
    return errorResponse(403, "forbidden");
  }

  const { id: classId } = await params;

  const classData = await prisma.classData.findUnique({ where: { id: classId } });
  if (!classData) {
    return errorResponse(404, "not_found");
  }

  const bookings = await prisma.booking.findMany({
    where: { classId, status: "confirmed" },
    include: { student: { include: { parent: { include: { user: true } } } } },
    orderBy: { updatedAt: "asc" },
  });

  const roster = bookings.map((booking) => ({
    bookingId: booking.id,
    studentName: booking.student.name,
    parentName: booking.student.parent.name,
    parentEmail: booking.student.parent.user.email,
    confirmedAt: booking.updatedAt,
  }));

  return NextResponse.json(roster);
}
