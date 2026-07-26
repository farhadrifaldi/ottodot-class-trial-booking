import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteSessionByToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { errorResponse } from "@/lib/api";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return errorResponse(401, "unauthorized");
  }

  await deleteSessionByToken(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
