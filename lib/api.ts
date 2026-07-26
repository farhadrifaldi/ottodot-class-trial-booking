import { NextResponse } from "next/server";

export function errorResponse(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}
