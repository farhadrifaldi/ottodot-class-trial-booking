import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "password123";

async function createParent(email: string, name: string, studentNames: string[]) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "PARENT",
      parent: {
        create: {
          name,
          students: { create: studentNames.map((name) => ({ name })) },
        },
      },
    },
    include: { parent: { include: { students: true } } },
  });
  return user.parent!;
}

async function main() {
  console.log("Seeding...");

  // --- Accounts -------------------------------------------------------
  const admin = await prisma.user.create({
    data: {
      email: "admin@ottodot.test",
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      role: "ADMIN",
    },
  });

  // parent1/parent2 are the two "real" demo accounts used to show the
  // cross-parent auth boundary and the register->login flow.
  const parent1 = await createParent("parent1@example.com", "Alice Parent", [
    "Emma",
    "Liam",
  ]);
  const parent2 = await createParent("parent2@example.com", "Bob Parent", [
    "Noah",
  ]);

  const emma = parent1.students.find((s) => s.name === "Emma")!;
  const liam = parent1.students.find((s) => s.name === "Liam")!;
  const noah = parent2.students.find((s) => s.name === "Noah")!;

  // Filler parents/students purely to occupy seats in Class B / Class C.
  const fillerNames = ["Olivia", "Ava", "Sophia", "Mason", "Isabella", "Ethan"];
  const fillerStudents = [];
  for (const [i, name] of fillerNames.entries()) {
    const p = await createParent(`filler${i + 1}@example.com`, `${name} Parent`, [
      name,
    ]);
    fillerStudents.push(p.students[0]);
  }

  // --- Classes ----------------------------------------------------------
  const classA = await prisma.classData.create({
    data: {
      subject: "Intro to Coding",
      description:
        "A hands-on first taste of programming — kids build a simple animated scene using block-based coding. No experience needed.",
      imageUrl: "/class-illustrations/coding.svg",
      startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
      durationMinutes: 45,
      isTrial: true,
    },
  });

  const classB = await prisma.classData.create({
    data: {
      subject: "Algebra Basics",
      description:
        "Covers variables and simple equations through visual puzzles, aimed at kids who've never seen algebra before.",
      imageUrl: "/class-illustrations/algebra.svg",
      startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4),
      durationMinutes: 45,
      isTrial: true,
    },
  });

  const classC = await prisma.classData.create({
    data: {
      subject: "Physics Fun",
      description:
        "Live experiments (balloons, magnets, ramps) demonstrating basic physics concepts, run over video call.",
      imageUrl: "/class-illustrations/physics.svg",
      startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
      durationMinutes: 60,
      isTrial: true,
    },
  });

  const classD = await prisma.classData.create({
    data: {
      subject: "Advanced Chemistry",
      description:
        "Regular-enrollment chemistry class covering stoichiometry; not currently offered as a trial.",
      imageUrl: null,
      startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6),
      durationMinutes: 90,
      capacity: 20,
      isTrial: false,
    },
  });

  // --- Bookings -----------------------------------------------------
  // Class B: exactly 3 confirmed (1 seat left) — the last-seat race demo class.
  for (const student of fillerStudents.slice(0, 3)) {
    const booking = await prisma.booking.create({
      data: { studentId: student.id, classId: classB.id, status: "confirmed" },
    });
    await prisma.paymentAttempt.create({
      data: { bookingId: booking.id, outcome: "succeeded" },
    });
  }

  // Class C: 4 confirmed (full) — one of them is Emma (a real login-able
  // parent's child), so a reviewer can log in as parent1 and re-POST the
  // same (Emma, Class C) pair to see the duplicate-booking rejection.
  const emmaClassCBooking = await prisma.booking.create({
    data: { studentId: emma.id, classId: classC.id, status: "confirmed" },
  });
  await prisma.paymentAttempt.create({
    data: { bookingId: emmaClassCBooking.id, outcome: "succeeded" },
  });
  for (const student of fillerStudents.slice(3, 6)) {
    const booking = await prisma.booking.create({
      data: { studentId: student.id, classId: classC.id, status: "confirmed" },
    });
    await prisma.paymentAttempt.create({
      data: { bookingId: booking.id, outcome: "succeeded" },
    });
  }

  // Payment-failure example: Noah tried Class A, card was declined. Class A
  // stays at 0 confirmed — a failed payment never touches the roster.
  const failedBooking = await prisma.booking.create({
    data: {
      studentId: noah.id,
      classId: classA.id,
      status: "payment_failed",
      failureReason: "card_declined",
    },
  });
  await prisma.paymentAttempt.create({
    data: { bookingId: failedBooking.id, outcome: "failed", reason: "card_declined" },
  });

  console.log("Seed complete.");
  console.log({
    admin: admin.email,
    parent1: parent1.userId,
    parent2: parent2.userId,
    classA: classA.id,
    classB: classB.id,
    classC: classC.id,
    classD: classD.id,
    liam: liam.id,
    emma: emma.id,
    noah: noah.id,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
