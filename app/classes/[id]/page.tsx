"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

type ClassDetail = {
  id: string;
  subject: string;
  description: string;
  imageUrl: string | null;
  startsAt: string;
  durationMinutes: number;
  isTrial: boolean;
  seatsAvailable: number;
};

type Student = { id: string; name: string };

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [students, setStudents] = useState<Student[] | null>(null);
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    apiFetch<ClassDetail>(`/api/classes/${id}`).then(({ status, data }) => {
      if (status === 401) {
        router.push("/login");
        return;
      }
      if (status !== 200) {
        setNotFound(true);
        return;
      }
      setClassData(data);
    });
    apiFetch<Student[]>("/api/students").then(({ status, data }) => {
      if (status === 200) {
        setStudents(data);
        if (data.length > 0) setStudentId(data[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function book() {
    if (!studentId) {
      setError("Choose a child first.");
      return;
    }
    setError(null);
    setBooking(true);
    const { status, data } = await apiFetch<{ id?: string; error?: string }>(
      "/api/bookings",
      { method: "POST", body: JSON.stringify({ studentId, classId: id }) }
    );
    setBooking(false);
    if (status === 201 && data.id) {
      router.push(`/bookings/${data.id}`);
      return;
    }
    setError(data?.error ?? "booking_failed");
  }

  if (notFound)
    return (
      <p className="py-8 text-sm text-destructive">Class not found.</p>
    );
  if (classData === null || students === null)
    return <p className="py-8 text-sm text-muted-foreground">Loading...</p>;

  const canBook = classData.isTrial && classData.seatsAvailable > 0 && students.length > 0;

  return (
    <div className="py-8">
      <Link
        href="/classes"
        className="mb-4 inline-block text-sm underline underline-offset-2"
      >
        &larr; Back to classes
      </Link>

      {classData.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={classData.imageUrl}
          alt={classData.subject}
          className="mb-4 h-48 w-full rounded-xl object-cover"
        />
      ) : (
        <div className="mb-4 flex h-48 w-full items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
          No illustration yet
        </div>
      )}

      <h1 className="font-heading text-2xl font-semibold">{classData.subject}</h1>
      <p className="mt-2 text-muted-foreground">{classData.description}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {new Date(classData.startsAt).toLocaleString()} · {classData.durationMinutes}{" "}
        minutes
      </p>
      <Badge
        variant={
          classData.isTrial && classData.seatsAvailable > 0 ? "secondary" : "outline"
        }
        className="mt-3"
      >
        {classData.isTrial
          ? classData.seatsAvailable > 0
            ? `${classData.seatsAvailable} seat(s) left`
            : "Full — no seats left"
          : "Not currently offered as a trial"}
      </Badge>

      {students.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No children on file yet —{" "}
          <Link href="/students" className="underline underline-offset-2">
            add one
          </Link>{" "}
          before booking.
        </p>
      ) : (
        <div className="mt-6 flex max-w-xs flex-col gap-1.5">
          <Label htmlFor="student">Booking for</Label>
          <select
            id="student"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <Button disabled={!canBook || booking} onClick={book} className="mt-4">
        {booking ? "Booking..." : "Book this class"}
      </Button>
    </div>
  );
}
