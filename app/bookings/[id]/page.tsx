"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import type { BookingStatus } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Booking = {
  id: string;
  status: BookingStatus;
  failureReason: string | null;
  cancellationReason: string | null;
};

export default function BookingStatusPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { status, data } = await apiFetch<Booking>(`/api/bookings/${id}`);
    if (status === 401) {
      router.push("/login");
      return;
    }
    if (status !== 200) {
      setError("Booking not found.");
      return;
    }
    setBooking(data);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function pay(simulateOutcome: "success" | "fail") {
    setPaying(true);
    setError(null);
    const { status, data } = await apiFetch<Booking>(`/api/bookings/${id}/pay`, {
      method: "POST",
      body: JSON.stringify({ simulateOutcome }),
    });
    setPaying(false);
    if (status === 200) {
      setBooking(data);
      return;
    }
    setError("Payment request failed.");
  }

  if (error)
    return <p className="py-8 text-sm text-destructive">{error}</p>;
  if (!booking)
    return <p className="py-8 text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="mx-auto max-w-md py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Booking status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <StatusBadge status={booking.status} />

          {booking.failureReason && (
            <p className="text-sm text-muted-foreground">
              Reason: <code className="rounded bg-muted px-1 py-0.5">{booking.failureReason}</code>
              {booking.failureReason === "capacity_exceeded" &&
                " — someone else confirmed this seat first. You have not been charged a real seat."}
            </p>
          )}

          {booking.status === "cancelled" && booking.cancellationReason && (
            <p className="text-sm text-muted-foreground">
              This booking was cancelled by Ottodot staff: &ldquo;{booking.cancellationReason}
              &rdquo;
            </p>
          )}

          {booking.status === "pending_payment" && (
            <div className="flex flex-col gap-2 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                This is a mock payment step — pick an outcome:
              </p>
              <Button disabled={paying} onClick={() => pay("success")}>
                {paying ? "Processing..." : "Simulate successful payment"}
              </Button>
              <Button
                variant="outline"
                disabled={paying}
                onClick={() => pay("fail")}
              >
                {paying ? "Processing..." : "Simulate declined payment"}
              </Button>
            </div>
          )}

          {booking.status === "payment_failed" && (
            <Link href="/classes" className="text-sm underline underline-offset-2">
              Try another class
            </Link>
          )}

          {(booking.status === "confirmed" || booking.status === "cancelled") && (
            <Link href="/classes" className="text-sm underline underline-offset-2">
              Back to classes
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
