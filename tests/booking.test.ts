import { describe, it, expect } from "vitest";
import { api, loginAs } from "./helpers";
import { testDb } from "./db";

describe("duplicate booking prevention", () => {
  it("rejects a duplicate confirmed booking for the same child+class", async () => {
    const emma = await testDb.student.findFirstOrThrow({ where: { name: "Emma" } });
    const classC = await testDb.classData.findFirstOrThrow({
      where: { subject: "Physics Fun" },
    });
    const cookie = await loginAs("parent1@example.com");

    const res = await api("/api/bookings", {
      method: "POST",
      cookie,
      body: { studentId: emma.id, classId: classC.id },
    });
    expect(res.status).toBe(409);
    expect(res.json.error).toBe("already_booked");
  });
});

describe("trial-only enforcement", () => {
  it("rejects booking creation against a non-trial class", async () => {
    const liam = await testDb.student.findFirstOrThrow({ where: { name: "Liam" } });
    const classD = await testDb.classData.findFirstOrThrow({
      where: { subject: "Advanced Chemistry" },
    });
    const cookie = await loginAs("parent1@example.com");

    const res = await api("/api/bookings", {
      method: "POST",
      cookie,
      body: { studentId: liam.id, classId: classD.id },
    });
    expect(res.status).toBe(422);
    expect(res.json.error).toBe("not_a_trial_class");
  });
});

describe("overbooking prevention at creation time", () => {
  it("rejects booking creation against a class already at 4 confirmed", async () => {
    const classC = await testDb.classData.findFirstOrThrow({
      where: { subject: "Physics Fun" },
    });
    const cookie = await loginAs("parent1@example.com");

    const res = await api("/api/bookings", {
      method: "POST",
      cookie,
      body: { studentId: (await testDb.student.findFirstOrThrow({ where: { name: "Liam" } })).id, classId: classC.id },
    });
    expect(res.status).toBe(409);
    expect(res.json.error).toBe("class_full");
  });
});

describe("payment failure handling", () => {
  it("does not add the child to the confirmed roster on a declined payment, and allows a retry afterward", async () => {
    const liam = await testDb.student.findFirstOrThrow({ where: { name: "Liam" } });
    const classA = await testDb.classData.findFirstOrThrow({
      where: { subject: "Intro to Coding" },
    });
    const cookie = await loginAs("parent1@example.com");

    const created = await api("/api/bookings", {
      method: "POST",
      cookie,
      body: { studentId: liam.id, classId: classA.id },
    });
    expect(created.status).toBe(201);
    const bookingId = created.json.id;

    const paid = await api(`/api/bookings/${bookingId}/pay`, {
      method: "POST",
      cookie,
      body: { simulateOutcome: "fail" },
    });
    expect(paid.status).toBe(200);
    expect(paid.json.status).toBe("payment_failed");
    expect(paid.json.failureReason).toBe("card_declined");

    const adminCookie = await loginAs("admin@ottodot.test");
    const roster = await api(`/api/classes/${classA.id}/roster`, {
      cookie: adminCookie,
    });
    expect(roster.json.map((r: { studentName: string }) => r.studentName)).not.toContain(
      "Liam"
    );

    // Retry: a fresh booking attempt for the same pair is allowed after a failure.
    const retried = await api("/api/bookings", {
      method: "POST",
      cookie,
      body: { studentId: liam.id, classId: classA.id },
    });
    expect(retried.status).toBe(201);
    expect(retried.json.status).toBe("pending_payment");

    const paidAgain = await api(`/api/bookings/${retried.json.id}/pay`, {
      method: "POST",
      cookie,
      body: { simulateOutcome: "success" },
    });
    expect(paidAgain.status).toBe(200);
    expect(paidAgain.json.status).toBe("confirmed");
  });
});

describe("listing my bookings ('which classes/children already booked')", () => {
  it("returns only the logged-in parent's own bookings, across all their children", async () => {
    const cookie1 = await loginAs("parent1@example.com");
    const res1 = await api("/api/bookings", { cookie: cookie1 });
    expect(res1.status).toBe(200);
    const studentNames1 = res1.json.map((b: { student: { name: string } }) => b.student.name);
    expect(studentNames1).toContain("Emma"); // Emma's confirmed Class C booking from seed
    expect(studentNames1).not.toContain("Noah"); // belongs to parent2, must never appear

    const cookie2 = await loginAs("parent2@example.com");
    const res2 = await api("/api/bookings", { cookie: cookie2 });
    expect(res2.status).toBe(200);
    const studentNames2 = res2.json.map((b: { student: { name: string } }) => b.student.name);
    expect(studentNames2).toContain("Noah"); // Noah's payment_failed Class A booking from seed
    expect(studentNames2).not.toContain("Emma");
  });

  it("rejects unauthenticated and non-PARENT requests", async () => {
    const anon = await api("/api/bookings");
    expect(anon.status).toBe(401);

    const adminCookie = await loginAs("admin@ottodot.test");
    const asAdmin = await api("/api/bookings", { cookie: adminCookie });
    expect(asAdmin.status).toBe(403);
  });
});

describe("class detail endpoint", () => {
  it("returns the same shape a parent needs before booking", async () => {
    const classA = await testDb.classData.findFirstOrThrow({
      where: { subject: "Intro to Coding" },
    });
    const cookie = await loginAs("parent1@example.com");
    const res = await api(`/api/classes/${classA.id}`, { cookie });
    expect(res.status).toBe(200);
    expect(res.json.subject).toBe("Intro to Coding");
    expect(res.json.isTrial).toBe(true);
    expect(typeof res.json.seatsAvailable).toBe("number");
  });

  it("404s for a class that doesn't exist", async () => {
    const cookie = await loginAs("parent1@example.com");
    const res = await api("/api/classes/does-not-exist", { cookie });
    expect(res.status).toBe(404);
  });
});

// Runs last in this file, after "overbooking prevention at creation time" has
// already exercised Class C while it's still full — these tests then cancel
// one of Class C's seed-confirmed bookings, so ordering here matters.
describe("admin cancellation (including already-paid bookings)", () => {
  it("lets an admin cancel a confirmed (paid) booking with a reason, freeing the seat", async () => {
    const classC = await testDb.classData.findFirstOrThrow({
      where: { subject: "Physics Fun" },
    });
    const mason = await testDb.student.findFirstOrThrow({ where: { name: "Mason" } });
    const masonBooking = await testDb.booking.findFirstOrThrow({
      where: { studentId: mason.id, classId: classC.id, status: "confirmed" },
    });

    const adminCookie = await loginAs("admin@ottodot.test");

    const cancelled = await api(`/api/bookings/${masonBooking.id}/cancel`, {
      method: "POST",
      cookie: adminCookie,
      body: { reason: "Family requested a refund" },
    });
    expect(cancelled.status).toBe(200);
    expect(cancelled.json.status).toBe("cancelled");
    expect(cancelled.json.cancellationReason).toBe("Family requested a refund");

    const roster = await api(`/api/classes/${classC.id}/roster`, { cookie: adminCookie });
    expect(roster.json.map((r: { studentName: string }) => r.studentName)).not.toContain(
      "Mason"
    );

    const classDetail = await api(`/api/classes/${classC.id}`, { cookie: adminCookie });
    expect(classDetail.json.seatsAvailable).toBe(1); // was 0/full before this cancellation

    // The freed seat is genuinely usable, not just a number that moved.
    const parentCookie = await loginAs("parent1@example.com");
    const liam = await testDb.student.findFirstOrThrow({ where: { name: "Liam" } });
    const newBooking = await api("/api/bookings", {
      method: "POST",
      cookie: parentCookie,
      body: { studentId: liam.id, classId: classC.id },
    });
    expect(newBooking.status).toBe(201);
    const paid = await api(`/api/bookings/${newBooking.json.id}/pay`, {
      method: "POST",
      cookie: parentCookie,
      body: { simulateOutcome: "success" },
    });
    expect(paid.json.status).toBe("confirmed");
  });

  it("rejects cancellation from a PARENT session", async () => {
    const failedBooking = await testDb.booking.findFirstOrThrow({
      where: { status: "payment_failed" },
    });
    const cookie = await loginAs("parent1@example.com");
    const res = await api(`/api/bookings/${failedBooking.id}/cancel`, {
      method: "POST",
      cookie,
      body: { reason: "nice try" },
    });
    expect(res.status).toBe(403);
  });

  it("rejects cancelling a booking that's already in a terminal state", async () => {
    const failedBooking = await testDb.booking.findFirstOrThrow({
      where: { status: "payment_failed" },
    });
    const adminCookie = await loginAs("admin@ottodot.test");
    const res = await api(`/api/bookings/${failedBooking.id}/cancel`, {
      method: "POST",
      cookie: adminCookie,
      body: { reason: "irrelevant" },
    });
    expect(res.status).toBe(409);
    expect(res.json.error).toBe("not_cancellable");
  });

  it("requires a non-empty reason", async () => {
    const classC = await testDb.classData.findFirstOrThrow({
      where: { subject: "Physics Fun" },
    });
    const emma = await testDb.student.findFirstOrThrow({ where: { name: "Emma" } });
    const booking = await testDb.booking.findFirstOrThrow({
      where: { studentId: emma.id, classId: classC.id },
    });
    const adminCookie = await loginAs("admin@ottodot.test");
    const res = await api(`/api/bookings/${booking.id}/cancel`, {
      method: "POST",
      cookie: adminCookie,
      body: { reason: "" },
    });
    expect(res.status).toBe(422);
  });

  it("404s for a booking that doesn't exist", async () => {
    const adminCookie = await loginAs("admin@ottodot.test");
    const res = await api("/api/bookings/does-not-exist/cancel", {
      method: "POST",
      cookie: adminCookie,
      body: { reason: "irrelevant" },
    });
    expect(res.status).toBe(404);
  });
});
