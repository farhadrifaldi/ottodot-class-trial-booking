export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<{ status: number; data: T }> {
  const res = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
  });
  const data = (await res.json().catch(() => null)) as T;
  return { status: res.status, data };
}
