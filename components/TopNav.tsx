"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { Role } from "@/lib/types";
import { Button } from "@/components/ui/button";

export default function TopNav() {
  const [session, setSession] = useState<
    { email: string; role: Role } | null | undefined
  >(undefined);

  useEffect(() => {
    apiFetch<{ email: string; role: Role }>("/api/auth/me").then(({ status, data }) => {
      setSession(status === 200 ? data : null);
    });
  }, []);

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <nav className="mb-6 flex items-center justify-between gap-4 border-b py-4">
      <Link href="/" className="font-heading text-base font-semibold">
        Ottodot Trial Booking
      </Link>
      <div className="flex items-center gap-4 text-sm">
        {session === undefined ? null : session ? (
          <>
            <span className="hidden text-muted-foreground sm:inline">
              {session.email} ({session.role})
            </span>
            {session.role === "PARENT" && (
              <>
                <Link href="/classes" className="text-foreground hover:underline">
                  Classes
                </Link>
                <Link href="/bookings" className="text-foreground hover:underline">
                  My Bookings
                </Link>
                <Link href="/students" className="text-foreground hover:underline">
                  My Children
                </Link>
              </>
            )}
            {session.role === "ADMIN" && (
              <Link href="/roster" className="text-foreground hover:underline">
                Roster
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={logout}>
              Log out
            </Button>
          </>
        ) : (
          <>
            <Link href="/login" className="text-foreground hover:underline">
              Log in
            </Link>
            <Link href="/register" className="text-foreground hover:underline">
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
