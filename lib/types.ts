// SQLite has no native enum support in Prisma (TECH_DESIGN.md §1), so these are
// plain strings in the DB, constrained to these unions at the application layer.

export type Role = "PARENT" | "ADMIN";

export type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "payment_failed"
  | "cancelled";

export type FailureReason =
  | "capacity_exceeded"
  | "card_declined"
  | "duplicate"
  | "not_a_trial_class";

export const TRIAL_SEAT_CAP = 4;
