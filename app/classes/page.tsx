"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ClassCard = {
  id: string;
  subject: string;
  description: string;
  imageUrl: string | null;
  startsAt: string;
  durationMinutes: number;
  seatsAvailable: number;
};

export default function ClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassCard[] | null>(null);

  useEffect(() => {
    apiFetch<ClassCard[]>("/api/classes?trial=true").then(({ status, data }) => {
      if (status === 401) {
        router.push("/login");
        return;
      }
      setClasses(data);
    });
  }, [router]);

  return (
    <div className="py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">Trial classes</h1>
        <Link href="/bookings" className="text-sm underline underline-offset-2">
          View my bookings
        </Link>
      </div>

      {classes === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10">
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {classes.map((c) => (
            <Card key={c.id}>
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.imageUrl}
                  alt={c.subject}
                  className="h-32 w-full object-cover"
                />
              ) : (
                <div className="flex h-32 w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                  No illustration yet
                </div>
              )}
              <CardHeader>
                <CardTitle>{c.subject}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                <p>{c.description}</p>
                <p>
                  {new Date(c.startsAt).toLocaleString()} · {c.durationMinutes} minutes
                </p>
                <Badge
                  variant={c.seatsAvailable > 0 ? "secondary" : "outline"}
                  className="w-fit"
                >
                  {c.seatsAvailable > 0 ? `${c.seatsAvailable} seat(s) left` : "Full"}
                </Badge>
              </CardContent>
              <CardFooter>
                <Link href={`/classes/${c.id}`} className="w-full">
                  <Button className="w-full">View details</Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
