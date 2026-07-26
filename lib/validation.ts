import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createBookingSchema = z.object({
  studentId: z.string().min(1),
  classId: z.string().min(1),
});

export const paySchema = z.object({
  simulateOutcome: z.enum(["success", "fail"]),
});

export const cancelBookingSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const createStudentSchema = z.object({
  name: z.string().trim().min(1).max(100),
});
