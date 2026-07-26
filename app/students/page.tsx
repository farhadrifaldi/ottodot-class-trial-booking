"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Student = { id: string; name: string };

export default function StudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  function loadStudents() {
    apiFetch<Student[]>("/api/students").then(({ status, data }) => {
      if (status === 401) {
        router.push("/login");
        return;
      }
      if (status === 200) setStudents(data);
    });
  }

  useEffect(() => {
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    const { status, data } = await apiFetch<{ error?: string }>("/api/students", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setAdding(false);
    if (status === 201) {
      setName("");
      loadStudents();
      return;
    }
    setError(data?.error ?? "add_student_failed");
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="mb-6 font-heading text-2xl font-semibold">My children</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Children on file</CardTitle>
          {students !== null && students.length === 0 && (
            <CardDescription>
              None yet — add one below before you can book a trial class.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {students === null ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : students.length === 0 ? (
            <p className="text-sm text-muted-foreground">No children yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {students.map((s) => (
                <li key={s.id} className="text-sm">
                  {s.name}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add a child</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="student-name">Child&apos;s name</Label>
              <Input
                id="student-name"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={adding}>
              {adding ? "Adding..." : "Add child"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/classes" className="underline underline-offset-2">
          Browse trial classes
        </Link>
      </p>
    </div>
  );
}
