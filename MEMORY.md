# MEMORY

## Commands
- Tests: `npx vitest run` (single file: `npx vitest run <path>`).
- Typecheck: `npx tsc --noEmit` — one pre-existing error in `src/app/authForms.test.tsx` (`beforeEach` not imported).
- Lint: `npx next lint` is not configured (opens interactive ESLint setup). No ruff — repo is TypeScript.
- Read-only live DB: node script with `node --env-file=.env` + supabase-js service role; catalog queries via psql pooler `aws-0-ap-northeast-1.pooler.supabase.com:6543`, user `postgres.<ref>` (direct `db.<ref>` host is IPv6-only).

## Conventions
- `call_confirmed` = "Qualified Call Booked". Set by Work Queue Qualified outcome, or setter verified = Yes on a booked lead (`resolveCallConfirmed`, applied in `stamp()`). One-way.
- Every operator milestone (qualify, setter verify, schedule/reschedule, show/no-show, won/lost) writes a `lead_activities` row AND `last_action`/`last_action_at`. Field edits (notes, deal value, recording, reminder) do not.

## Insights
- Cohort URLs (`?cohort=`) window on `created_at` in IST days (`istDayStartUtcIso`/`istDayEndUtcIso`); milestones are "ever reached" flags, not timestamps in range.
- `lead_activities.type` is free text (no CHECK constraint); `created_by` FKs `profiles(id)`.
- `computeActionStatus` ignores its `_lastCallOutcome` arg, so `last_action` label text does not affect status.
- `*_at` milestone columns are first-set timestamps (`firstSetAt`), not last-change times.

## Deferred
- Backfill of historical `last_action` for ~88 leads from milestone timestamps — declined for now (heuristic; `*_at` are first-set times). Vaidik + Shibajyoti `call_confirmed` and Vaidik `last_action` were backfilled 2026-09-23.
- `logVerificationCallAttempt` (detail page) still doesn't write `last_action`/activity.
- Setter verified "Unqualified" help text says it moves lead to Dead, but `saveLeadActions` doesn't set `is_dead`.
