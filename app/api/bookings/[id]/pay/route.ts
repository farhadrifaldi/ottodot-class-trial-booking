import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { paySchema } from "@/lib/validation";
import { TRIAL_SEAT_CAP } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return errorResponse(401, "unauthorized");
  }

  const { id: bookingId } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { student: true },
  });
  if (!booking) {
    return errorResponse(404, "not_found");
  }

  const isOwner = booking.student.parentId === sessionUser.parentId;
  if (!isOwner && sessionUser.role !== "ADMIN") {
    return errorResponse(403, "forbidden");
  }

  const body = await request.json().catch(() => null);
  const parsed = paySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(422, "invalid_request");
  }

  // Idempotent no-op if this booking was already resolved by an earlier call.
  if (booking.status !== "pending_payment") {
    return NextResponse.json(booking);
  }

  if (parsed.data.simulateOutcome === "fail") {
    const [, updated] = await prisma.$transaction([
      prisma.paymentAttempt.create({
        data: { bookingId, outcome: "failed", reason: "card_declined" },
      }),
      prisma.booking.update({
        where: { id: bookingId },
        data: { status: "payment_failed", failureReason: "card_declined" },
      }),
    ]);
    return NextResponse.json(updated);
  }

  // simulateOutcome === "success": a successful mock charge does NOT by
  // itself guarantee a confirmed seat. Step B (TECH_DESIGN.md §5) re-counts
  // confirmed bookings for this class inside one transaction and only then
  // decides confirmed vs. payment_failed(capacity_exceeded) — this is the
  // fix for the last-seat race described in the brief.
  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        const confirmedCount = await tx.booking.count({
          where: { classId: booking.classId, status: "confirmed" },
        });

        if (confirmedCount >= TRIAL_SEAT_CAP) {
          await tx.paymentAttempt.create({
            data: { bookingId, outcome: "succeeded" },
          });
          return tx.booking.update({
            where: { id: bookingId },
            data: { status: "payment_failed", failureReason: "capacity_exceeded" },
          });
        }

        await tx.paymentAttempt.create({
          data: { bookingId, outcome: "succeeded" },
        });
        return tx.booking.update({
          where: { id: bookingId },
          data: { status: "confirmed" },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return NextResponse.json(updated);
  } catch (error) {
    // Defense in depth: the partial unique index (TECH_DESIGN.md §1/§4) is the
    // authoritative guard against two confirmed bookings for the same
    // student+class pair. If it ever fires here, the booking loses instead of
    // corrupting the roster.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: { status: "payment_failed", failureReason: "duplicate" },
      });
      return NextResponse.json(updated);
    }
    throw error;
  }
}
