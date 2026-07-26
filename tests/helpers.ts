import { BASE_URL } from "./constants";

export async function api(
  path: string,
  options: { method?: string; body?: unknown; cookie?: string } = {}
) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const setCookies = res.headers.getSetCookie();
  const sessionCookie = setCookies
    .find((c) => c.startsWith("session_token="))
    ?.split(";")[0];

  const json = await res.json().catch(() => null);
  return { status: res.status, json, cookie: sessionCookie };
}

export async function loginAs(email: string, password = "password123") {
  const { status, cookie } = await api("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  if (status !== 200 || !cookie) {
    throw new Error(`login failed for ${email}: status ${status}`);
  }
  return cookie;
}
