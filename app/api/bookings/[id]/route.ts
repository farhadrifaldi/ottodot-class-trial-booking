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

  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { student: true },
  });

  if (!booking) {
    return errorResponse(404, "not_found");
  }

  const isOwner = booking.student.parentId === sessionUser.parentId;
  if (!isOwner && sessionUser.role !== "ADMIN") {
    return errorResponse(403, "forbidden");
  }

  return NextResponse.json(booking);
}
