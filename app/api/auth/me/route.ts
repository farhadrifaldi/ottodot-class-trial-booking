import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";

// Support endpoint for the UI (not part of the core booking flow documented
// in TECH_DESIGN.md) so the client knows who's logged in and can route
// accordingly, without ever trusting client-supplied identity for anything
// that actually matters (that's still all session-derived server-side).
export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return errorResponse(401, "unauthorized");
  }
  return NextResponse.json(sessionUser);
}
