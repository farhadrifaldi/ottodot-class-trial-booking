import { describe, it, expect } from "vitest";
import { api, loginAs } from "./helpers";
import { testDb } from "./db";

describe("registration and login", () => {
  it("signup creates an account but does NOT create a session", async () => {
    const email = `new-parent-${Date.now()}@example.com`;
    const signup = await api("/api/auth/signup", {
      method: "POST",
      body: { email, password: "password123", name: "New Parent" },
    });
    expect(signup.status).toBe(201);
    expect(signup.cookie).toBeUndefined();

    // No login happened, so this must be unauthorized even right after signup.
    const students = await api("/api/students");
    expect(students.status).toBe(401);

    // Now log in with the same credentials — this is the separate second step.
    const login = await api("/api/auth/login", {
      method: "POST",
      body: { email, password: "password123" },
    });
    expect(login.status).toBe(200);
    expect(login.cookie).toBeDefined();

    const studentsAfterLogin = await api("/api/students", {
      cookie: login.cookie,
    });
    expect(studentsAfterLogin.status).toBe(200);
    expect(studentsAfterLogin.json).toEqual([]);
  });

  it("rejects signup with an already-registered email", async () => {
    const res = await api("/api/auth/signup", {
      method: "POST",
      body: { email: "parent1@example.com", password: "password123", name: "X" },
    });
    expect(res.status).toBe(409);
    expect(res.json.error).toBe("email_taken");
  });

  it("rejects login with a wrong password using a generic error", async () => {
    const res = await api("/api/auth/login", {
      method: "POST",
      body: { email: "parent1@example.com", password: "wrong-password" },
    });
    expect(res.status).toBe(401);
    expect(res.json.error).toBe("invalid_credentials");
  });

  it("rejects login for an unregistered email with the same generic error", async () => {
    const res = await api("/api/auth/login", {
      method: "POST",
      body: { email: "nobody-here@example.com", password: "password123" },
    });
    expect(res.status).toBe(401);
    expect(res.json.error).toBe("invalid_credentials");
  });
});

describe("cross-parent access boundary (IDOR fix)", () => {
  it("never returns another parent's children", async () => {
    const cookie = await loginAs("parent1@example.com");
    const res = await api("/api/students", { cookie });
    expect(res.status).toBe(200);
    const names = res.json.map((s: { name: string }) => s.name).sort();
    expect(names).toEqual(["Emma", "Liam"]);
    expect(names).not.toContain("Noah");
  });

  it("rejects a parent trying to book using another parent's child", async () => {
    const emma = await testDb.student.findFirstOrThrow({ where: { name: "Emma" } });
    const classA = await testDb.classData.findFirstOrThrow({
      where: { subject: "Intro to Coding" },
    });

    const cookie = await loginAs("parent2@example.com");
    const res = await api("/api/bookings", {
      method: "POST",
      cookie,
      body: { studentId: emma.id, classId: classA.id },
    });
    expect(res.status).toBe(403);
    expect(res.json.error).toBe("forbidden");
  });
});

describe("admin-only roster", () => {
  it("rejects a PARENT session from the roster endpoint", async () => {
    const classA = await testDb.classData.findFirstOrThrow({
      where: { subject: "Intro to Coding" },
    });
    const cookie = await loginAs("parent1@example.com");
    const res = await api(`/api/classes/${classA.id}/roster`, { cookie });
    expect(res.status).toBe(403);
  });

  it("allows an ADMIN session to view the roster", async () => {
    const classC = await testDb.classData.findFirstOrThrow({
      where: { subject: "Physics Fun" },
    });
    const cookie = await loginAs("admin@ottodot.test");
    const res = await api(`/api/classes/${classC.id}/roster`, { cookie });
    expect(res.status).toBe(200);
    expect(res.json.length).toBe(4);
  });

  it("rejects unauthenticated requests to every protected route", async () => {
    const classA = await testDb.classData.findFirstOrThrow({
      where: { subject: "Intro to Coding" },
    });
    const results = await Promise.all([
      api("/api/students"),
      api("/api/classes"),
      api(`/api/classes/${classA.id}/roster`),
      api("/api/bookings", { method: "POST", body: {} }),
    ]);
    for (const r of results) {
      expect(r.status).toBe(401);
    }
  });
});

describe("adding a child (a freshly-registered parent has none by default)", () => {
  it("lets a logged-in parent add a child, scoped to their own account", async () => {
    const email = `new-parent-with-kid-${Date.now()}@example.com`;
    await api("/api/auth/signup", {
      method: "POST",
      body: { email, password: "password123", name: "New Parent" },
    });
    const cookie = await loginAs(email);

    const before = await api("/api/students", { cookie });
    expect(before.json).toEqual([]);

    const created = await api("/api/students", {
      method: "POST",
      cookie,
      body: { name: "Kiddo" },
    });
    expect(created.status).toBe(201);
    expect(created.json.name).toBe("Kiddo");

    const after = await api("/api/students", { cookie });
    expect(after.json.map((s: { name: string }) => s.name)).toEqual(["Kiddo"]);

    // Never leaks into another parent's own list.
    const otherCookie = await loginAs("parent1@example.com");
    const otherStudents = await api("/api/students", { cookie: otherCookie });
    expect(
      otherStudents.json.map((s: { name: string }) => s.name)
    ).not.toContain("Kiddo");
  });

  it("rejects an empty/whitespace-only name", async () => {
    const cookie = await loginAs("parent1@example.com");
    const res = await api("/api/students", {
      method: "POST",
      cookie,
      body: { name: "   " },
    });
    expect(res.status).toBe(422);
  });

  it("rejects unauthenticated and non-PARENT requests", async () => {
    const anon = await api("/api/students", { method: "POST", body: { name: "X" } });
    expect(anon.status).toBe(401);

    const adminCookie = await loginAs("admin@ottodot.test");
    const asAdmin = await api("/api/students", {
      method: "POST",
      cookie: adminCookie,
      body: { name: "X" },
    });
    expect(asAdmin.status).toBe(403);
  });
});
