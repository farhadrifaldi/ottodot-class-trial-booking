import { describe, it, expect } from "vitest";
import { api, loginAs } from "./helpers";
import { testDb } from "./db";

// The required scenario from the brief: two parents racing for the same last
// seat. Class B is seeded at exactly 3 confirmed of 4 (TECH_DESIGN.md §9),
// and neither Liam nor Noah have an existing booking against it.
describe("last-seat race (required scenario)", () => {
  it("lets at most one of two simultaneous payers end up confirmed", async () => {
    const classB = await testDb.classData.findFirstOrThrow({
      where: { subject: "Algebra Basics" },
    });
    const liam = await testDb.student.findFirstOrThrow({ where: { name: "Liam" } });
    const noah = await testDb.student.findFirstOrThrow({ where: { name: "Noah" } });

    const before = await testDb.booking.count({
      where: { classId: classB.id, status: "confirmed" },
    });
    expect(before).toBe(3);

    const cookieA = await loginAs("parent1@example.com"); // Liam's parent
    const cookieB = await loginAs("parent2@example.com"); // Noah's parent

    // Both parents select the same last slot — both must reach pending_payment.
    const [bookingA, bookingB] = await Promise.all([
      api("/api/bookings", {
        method: "POST",
        cookie: cookieA,
        body: { studentId: liam.id, classId: classB.id },
      }),
      api("/api/bookings", {
        method: "POST",
        cookie: cookieB,
        body: { studentId: noah.id, classId: classB.id },
      }),
    ]);
    expect(bookingA.status).toBe(201);
    expect(bookingB.status).toBe(201);
    expect(bookingA.json.status).toBe("pending_payment");
    expect(bookingB.json.status).toBe("pending_payment");

    // Both pay for the same last seat at the same time.
    const [payA, payB] = await Promise.all([
      api(`/api/bookings/${bookingA.json.id}/pay`, {
        method: "POST",
        cookie: cookieA,
        body: { simulateOutcome: "success" },
      }),
      api(`/api/bookings/${bookingB.json.id}/pay`, {
        method: "POST",
        cookie: cookieB,
        body: { simulateOutcome: "success" },
      }),
    ]);

    const outcomes = [payA.json.status, payB.json.status].sort();
    expect(outcomes).toEqual(["confirmed", "payment_failed"]);

    const loser = payA.json.status === "payment_failed" ? payA.json : payB.json;
    expect(loser.failureReason).toBe("capacity_exceeded");

    const after = await testDb.booking.count({
      where: { classId: classB.id, status: "confirmed" },
    });
    expect(after).toBe(4); // never 5 — the invariant holds
  });
});
