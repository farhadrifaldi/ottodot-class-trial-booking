# Ottodot Trial Booking

A backend-led slice of a trial-class booking system: a parent registers, logs in, picks a child and an available trial class, submits a booking, goes through a mock payment step, and sees the resulting status. An admin/teacher can view the confirmed roster per class. Regular enrollment is explicitly out of scope.

Full design rationale — schema, transaction logic, sequence diagrams, assumptions — lives in [`TECH_DESIGN.md`](./TECH_DESIGN.md). This README is the practical "how to run it and why it's built this way" summary the take-home asks for. AI usage is logged in [`AI_USAGE.md`](./AI_USAGE.md).

## How to run

Requires Node 20+.

```bash
npm install
npx prisma migrate deploy   # creates prisma/dev.db and applies the schema + partial unique index
npm run seed                # loads the fixtures described below
npm run dev                 # http://localhost:3000
```

Log in with one of the seeded accounts (password for all: `password123`):

| Email | Role |
|---|---|
| `parent1@example.com` | Parent (children: Emma, Liam) |
| `parent2@example.com` | Parent (child: Noah) |
| `admin@ottodot.test` | Admin (roster view) |

Interactive API docs (Swagger UI, generated from `openapi.yaml`): **http://localhost:3000/api-docs**

Run the tests (builds and starts a real production server against a disposable SQLite test database, isolated from any dev server you might already have running — no mocking):

```bash
npm test
```

## What I built

- **Auth**: registration and login as two explicit, separate steps (see `TECH_DESIGN.md` §2) — signup only creates the account, login creates the session. Session is a DB-backed token in an `httpOnly` cookie. Every parent-scoped endpoint derives identity from that session, never from a client-supplied ID.
- **Add a child**: `POST /api/students` — a freshly-registered parent starts with zero children (seed data aside), so this is what actually lets them book anything. Scoped to the caller's own account like everything else.
- **Class browsing**: `GET /api/classes?trial=true` (list) and `GET /api/classes/:id` (detail) return subject, description, illustration, start time, duration, and a live seats-remaining count.
- **Booking + mock payment**: `POST /api/bookings` creates a `pending_payment` booking after checking trial-eligibility, ownership, and duplicates. `POST /api/bookings/:id/pay` takes a `simulateOutcome: "success" | "fail"` and runs the actual capacity-enforcing transaction.
- **Booking status & history**: `GET /api/bookings/:id` shows a single booking's current state (`pending_payment` / `confirmed` / `payment_failed` + reason / `cancelled`); `GET /api/bookings` lists everything a parent's family has ever booked, across all their children — "which classes/kids are already booked and paid."
- **Admin roster**: `GET /api/classes/:id/roster` — confirmed students only, admin-only.
- **Admin cancellation**: `POST /api/bookings/:id/cancel` — an admin can cancel a booking even if it's already `confirmed`/paid, with a required free-text reason stored on the booking and shown to the parent. Cancelling a confirmed booking frees the seat immediately with no extra bookkeeping (see `TECH_DESIGN.md` §5a) — a direct payoff of every capacity check counting `confirmed` rows live rather than a cached counter.
- **Minimal UI**: register/login, a "My Children" page for adding kids, a class list, a class detail page (where a child is actually picked and the booking fires), a booking-status page with the mock-payment buttons (and the cancellation reason, if cancelled), a "My Bookings" history page, and an admin roster page with a per-row cancel action.
- **Tests**: 26 vitest integration tests hitting a real, freshly-built production server (`next build && next start`, isolated from any `next dev` a reviewer might have open) over HTTP with real cookies, including the exact concurrency scenario from the brief. Re-run repeatedly (not just once) to rule out flakiness — see `AI_USAGE.md` for a real flake that surfaced and was fixed this way.

## Time spent

Roughly the equivalent of a 3–4 hour focused session: design (data model, the race-condition strategy, sequence diagrams, iterating on the design doc) took the larger share, with implementation, tests, and this documentation making up the rest. The full decision-by-decision trail — including things that were designed one way and then corrected once actually implemented — is in `AI_USAGE.md`.

## Assumptions

The full list with rationale is in `TECH_DESIGN.md`'s **Assumptions** section. The two load-bearing ones:

- **`ClassData` is assumed to be owned by another system** (a course catalog/scheduling service) in a real deployment; this app only ever reads it, never writes to it. "Trial" is modeled as an `isTrial` flag on that shared entity rather than a separate table, and the trial-specific 4-seat cap is a constant this booking system owns, deliberately decoupled from `classData.capacity` (which stands in for that other system's regular-enrollment capacity).
- **No real payment gateway** — `simulateOutcome: "success" | "fail"` on the pay endpoint stands in for a payment provider's response, so behavior is deterministic and testable.

## Key architecture & backend decisions

**Stack**: Next.js (App Router, TypeScript) + Prisma + SQLite. Chosen for zero external-account setup and because SQLite's single-writer transaction model makes the concurrency story easy to both implement and explain — the tradeoff (no true concurrent writers, not a production Postgres setup) is accepted and documented.

**Data model** (`prisma/schema.prisma`, full detail in `TECH_DESIGN.md` §1): `User` (with `role`) → `Parent` → `Student` → `Booking` → `ClassData`, plus `Session` and `PaymentAttempt`. **Note on enums**: SQLite has no native Prisma enum support — `role` and `status` are plain `String` columns constrained by TypeScript unions (`lib/types.ts`) and zod at the API boundary, not by the database. This was actually discovered mid-implementation (the original design draft used Prisma enums, which failed the first `prisma migrate dev` run against SQLite) — see `AI_USAGE.md` for the full story.

**Booking statuses**: `pending_payment`, `confirmed`, `payment_failed`, `cancelled`, with a `failureReason` field (`capacity_exceeded` / `card_declined` / `duplicate` / `not_a_trial_class`) carrying detail without exploding the status enum.

**Duplicate-booking prevention**: two layers. An application-level check on `POST /api/bookings` rejects a second attempt while a `confirmed` booking already exists for that child+class. The actual guarantee is a **partial unique index** — `CREATE UNIQUE INDEX ... ON "Booking" ("studentId","classId") WHERE "status" = 'confirmed'` — hand-added to the migration since `schema.prisma` can't express a filtered `WHERE` on a unique index. Even a bug in the app logic can't create two confirmed bookings for the same child+class.

**The last-seat race (required scenario)** — approach and why:

1. Booking *creation* only checks `confirmed` count (not other pending holds) against a fixed `TRIAL_SEAT_CAP = 4`. This is deliberate: if a pending hold blocked others from even selecting the same slot, the race in the brief couldn't happen at all — two parents legitimately need to both reach the payment screen for the same last seat.
2. The actual capacity check happens once, **inside one transaction**, at payment confirmation: re-count confirmed bookings, and only then decide `confirmed` vs. `payment_failed(capacity_exceeded)`. Whichever payment transaction commits first wins the seat; the second re-reads post-commit and loses.
3. SQLite serializes writers by default, so this requires no extra locking to be correct on this stack. The same transaction shape (`SELECT ... FOR UPDATE` on the class row, or `SERIALIZABLE` isolation) is what would carry this over to Postgres.

I chose this over a queue/reservation-token system because it needs no extra infrastructure and is easy to verify directly (`tests/race.test.ts` fires two real concurrent HTTP payment requests and asserts exactly one `confirmed` result and a roster count that never exceeds 4). The tradeoff: a parent can occasionally start a mock payment for a seat that's already effectively gone, and finds out only at that point rather than being blocked earlier — an acceptable, honestly-stated UX tradeoff for a take-home, not something I'd necessarily ship as-is at real user volumes (see "What I'd do next").

**Payment failure handling**: every pay attempt writes a `PaymentAttempt` audit row regardless of outcome. A declined payment (`simulateOutcome: "fail"`) never touches the confirmed roster and never consumed real capacity in the first place (see point 1 above). A *successful* mock charge does not by itself guarantee a confirmed seat — that's the one non-obvious rule in this system, and it's what the race-condition handling above depends on.

**Which checks belong where** (full table in `TECH_DESIGN.md` §8): UI is cosmetic only (disable full/non-trial classes, redirect when unauthenticated) — never trusted. API/backend does session validation, input validation (zod), ownership checks, and orchestrates the transactions. The database enforces the two real invariants (partial unique index, transactional capacity check) that nothing else is allowed to rely on alone.

**Auth**: real accounts (bcrypt-hashed passwords), DB-backed sessions via `httpOnly` cookie, registration and login as two separate steps. Added specifically because the first design draft trusted a client-supplied `parentId` on every endpoint — an IDOR hole where parent A could read parent B's children. See `AI_USAGE.md` for how that was caught.

**API documentation**: `openapi.yaml` at the repo root is hand-maintained (not generated) given the endpoint count for this take-home, served at `/api-docs` via Swagger UI. Validated with `npx @redocly/cli lint`.

## What I'd do next with more time

- Real browser/E2E coverage (Playwright) — today's verification is API/HTTP-level only.
- The background TTL sweep for abandoned `pending_payment` bookings and expired sessions.
- Move to Postgres with `SELECT ... FOR UPDATE` for the capacity check, for genuine concurrent writers.
- Generate `openapi.yaml` from the `zod` schemas instead of hand-maintaining both.
- A real payment gateway integration behind the same `pay` endpoint contract.
- Password reset, email verification, and login rate limiting.

## Seed data & how to see the required edge cases

`npm run seed` creates:

- **Class A** ("Intro to Coding") — 0 confirmed of 4, open seats.
- **Class B** ("Algebra Basics") — exactly 3 confirmed of 4 (one seat left) — used by `tests/race.test.ts` to reproduce the required last-seat race with two real concurrent HTTP requests.
- **Class C** ("Physics Fun") — 4 confirmed of 4 (full), including Emma (parent1's child) — log in as `parent1@example.com` and `POST /api/bookings` for Emma against this class again to see `already_booked`; try any other child against it to see `class_full`.
- **Class D** ("Advanced Chemistry") — `isTrial: false` — booking against it returns `not_a_trial_class` even though it has open seats, proving trial-only scope is enforced, not just documented.
- A `payment_failed` booking (Noah, Class A, `card_declined`) already on record, so the failure path has a visible example without needing to trigger one manually.

`npm test` exercises all of the above automatically, plus the auth boundary (a parent can never see another parent's children) and the register-before-login flow.
