"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import type { BookingStatus } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type MyBooking = {
  id: string;
  status: BookingStatus;
  failureReason: string | null;
  cancellationReason: string | null;
  createdAt: string;
  student: { id: string; name: string };
  classData: { id: string; subject: string; startsAt: string };
};

export default function MyBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<MyBooking[] | null>(null);

  useEffect(() => {
    apiFetch<MyBooking[]>("/api/bookings").then(({ status, data }) => {
      if (status === 401) {
        router.push("/login");
        return;
      }
      setBookings(data);
    });
  }, [router]);

  if (bookings === null)
    return <p className="py-8 text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">My bookings</h1>
        <Link href="/classes" className="text-sm underline underline-offset-2">
          Browse trial classes
        </Link>
      </div>

      {bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bookings yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Child</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Class date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.student.name}</TableCell>
                  <TableCell>{b.classData.subject}</TableCell>
                  <TableCell>
                    {new Date(b.classData.startsAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={b.status} />
                    {b.failureReason && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {b.failureReason}
                      </div>
                    )}
                    {b.cancellationReason && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Cancelled: {b.cancellationReason}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/bookings/${b.id}`}
                      className="underline underline-offset-2"
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
