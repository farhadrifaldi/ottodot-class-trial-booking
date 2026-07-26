"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import type { Role } from "@/lib/types";
import { Button } from "@/components/ui/button";

export default function Home() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    apiFetch<{ role?: Role }>("/api/auth/me").then(({ status, data }) => {
      if (status === 200) {
        router.replace(data.role === "ADMIN" ? "/roster" : "/classes");
      } else {
        setChecked(true);
      }
    });
  }, [router]);

  if (!checked) return null;

  return (
    <div className="flex flex-col gap-3 py-8">
      <h1 className="font-heading text-2xl font-semibold">Ottodot Trial Booking</h1>
      <p className="text-muted-foreground">
        Book a trial science or math class for your child.
      </p>
      <div className="mt-2 flex gap-3">
        <Link href="/login">
          <Button>Log in</Button>
        </Link>
        <Link href="/register">
          <Button variant="outline">Register</Button>
        </Link>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        API documentation:{" "}
        <Link href="/api-docs" className="underline underline-offset-2">
          /api-docs
        </Link>
      </p>
    </div>
  );
}
