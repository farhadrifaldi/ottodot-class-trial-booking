import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { cancelBookingSchema } from "@/lib/validation";

// Admin-only: cancel a booking even if it's already `confirmed` (paid), with
// a required free-text reason. Deliberately allowed on `pending_payment` too
// (e.g. an admin clearing out a stuck/abandoned hold), but not on bookings
// already in a terminal state (`payment_failed` / `cancelled`) — cancelling
// those again is meaningless.
//
// Cancelling a `confirmed` booking needs no separate "free the seat" step:
// every capacity check in this app (POST /api/bookings, POST .../pay) counts
// `status: "confirmed"` live, so the moment this booking's status flips away
// from `confirmed`, the seat is already back in the available count.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return errorResponse(401, "unauthorized");
  }
  if (sessionUser.role !== "ADMIN") {
    return errorResponse(403, "forbidden");
  }

  const { id: bookingId } = await params;
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    return errorResponse(404, "not_found");
  }

  if (booking.status !== "pending_payment" && booking.status !== "confirmed") {
    return errorResponse(409, "not_cancellable");
  }

  const body = await request.json().catch(() => null);
  const parsed = cancelBookingSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(422, "invalid_request");
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "cancelled", cancellationReason: parsed.data.reason },
  });

  return NextResponse.json(updated);
}
