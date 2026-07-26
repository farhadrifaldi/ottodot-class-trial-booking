import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { TRIAL_SEAT_CAP } from "@/lib/types";

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return errorResponse(401, "unauthorized");
  }

  const trialParam = request.nextUrl.searchParams.get("trial");
  const isTrial = trialParam === null ? true : trialParam === "true";

  const classes = await prisma.classData.findMany({
    where: { isTrial },
    orderBy: { startsAt: "asc" },
  });

  const results = await Promise.all(
    classes.map(async (classData) => {
      const confirmedCount = await prisma.booking.count({
        where: { classId: classData.id, status: "confirmed" },
      });
      return {
        id: classData.id,
        subject: classData.subject,
        description: classData.description,
        imageUrl: classData.imageUrl,
        startsAt: classData.startsAt,
        durationMinutes: classData.durationMinutes,
        isTrial: classData.isTrial,
        // A courtesy estimate, not a reservation — see TECH_DESIGN.md §5.
        seatsAvailable: Math.max(0, TRIAL_SEAT_CAP - confirmedCount),
      };
    })
  );

  return NextResponse.json(results);
}
