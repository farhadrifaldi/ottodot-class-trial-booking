"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ClassOption = { id: string; subject: string };
type RosterEntry = {
  bookingId: string;
  studentName: string;
  parentName: string;
  parentEmail: string;
  confirmedAt: string;
};

export default function RosterPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassOption[] | null>(null);
  const [classId, setClassId] = useState("");
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ClassOption[]>("/api/classes?trial=true").then(({ status, data }) => {
      if (status === 401) {
        router.push("/login");
        return;
      }
      if (status === 403) {
        setError("Admin access required.");
        return;
      }
      setClasses(data);
      if (data.length > 0) setClassId(data[0].id);
    });
  }, [router]);

  const loadRoster = useCallback((id: string) => {
    apiFetch<RosterEntry[]>(`/api/classes/${id}/roster`).then(({ status, data }) => {
      if (status === 403) {
        setError("Admin access required.");
        return;
      }
      setRoster(data);
    });
  }, []);

  useEffect(() => {
    if (!classId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoster(null);
    loadRoster(classId);
  }, [classId, loadRoster]);

  async function cancelBooking(bookingId: string) {
    const reason = window.prompt(
      "Reason for cancelling this booking (shown to the parent)?"
    );
    if (!reason || !reason.trim()) return;

    setCancellingId(bookingId);
    const { status } = await apiFetch(`/api/bookings/${bookingId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: reason.trim() }),
    });
    setCancellingId(null);
    if (status === 200) {
      loadRoster(classId);
    } else {
      window.alert("Could not cancel this booking.");
    }
  }

  if (error) return <p className="py-8 text-sm text-destructive">{error}</p>;
  if (classes === null)
    return <p className="py-8 text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="py-8">
      <h1 className="mb-6 font-heading text-2xl font-semibold">Trial class roster</h1>
      <div className="mb-6 flex max-w-xs flex-col gap-1.5">
        <Label htmlFor="class">Class</Label>
        <select
          id="class"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.subject}
            </option>
          ))}
        </select>
      </div>

      {roster === null ? (
        <p className="text-sm text-muted-foreground">Loading roster...</p>
      ) : roster.length === 0 ? (
        <p className="text-sm text-muted-foreground">No confirmed students yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Parent email</TableHead>
                <TableHead>Confirmed at</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {roster.map((r) => (
                <TableRow key={r.bookingId}>
                  <TableCell>{r.studentName}</TableCell>
                  <TableCell>{r.parentName}</TableCell>
                  <TableCell>{r.parentEmail}</TableCell>
                  <TableCell>{new Date(r.confirmedAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={cancellingId === r.bookingId}
                      onClick={() => cancelBooking(r.bookingId)}
                    >
                      {cancellingId === r.bookingId ? "Cancelling..." : "Cancel booking"}
                    </Button>
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
