# MEMORY

## Commands
- Tests: `npx vitest run` (single file: `npx vitest run <path>`).
- Typecheck: `npx tsc --noEmit` — one pre-existing error in `src/app/authForms.test.tsx` (`beforeEach` not imported).
- Lint: `npx next lint` is not configured (opens interactive ESLint setup). No ruff — repo is TypeScript.
- Read-only live DB: node script with `node --env-file=.env` + supabase-js service role; catalog queries via psql pooler `aws-0-ap-northeast-1.pooler.supabase.com:6543`, user `postgres.<ref>` (direct `db.<ref>` host is IPv6-only).

## Conventions
- `call_confirmed` = "Qualified Call Booked". Set by Work Queue Qualified outcome, or setter verified = Yes on a booked lead (`resolveCallConfirmed`, applied in `stamp()`). One-way.
- Every operator milestone (qualify, setter verify, schedule/reschedule, show/no-show, won/lost) writes a `lead_activities` row AND `last_action`/`last_action_at`. Field edits (notes, deal value, recording, reminder) do not.

- Actor UUIDs live in `lead_activities.created_by`; do NOT add `*_by` UUID columns to `leads` (user decision). Legacy `leads.*_by` are text emails.
- Manual lead sources: `referral` / `manual` / `other` (`MANUAL_LEAD_SOURCES`). Placeholder email `manual-phone-<digits>@manual.invalid`.
- Server actions that need user-visible errors return `{ ok, error }` (thrown messages are masked in prod).
- User said no live DB writes for sanity checks — ask before creating test rows.

## Insights
- Cohort URLs (`?cohort=`) window on `created_at` in IST days (`istDayStartUtcIso`/`istDayEndUtcIso`); milestones are "ever reached" flags, not timestamps in range.
- `lead_activities.type` is free text (no CHECK constraint); `created_by` FKs `profiles(id)`.
- `computeActionStatus` ignores its `_lastCallOutcome` arg, so `last_action` label text does not affect status.
- `*_at` milestone columns are first-set timestamps (`firstSetAt`), not last-change times.

- E2E: `e2e/*.spec.ts` need `PLAYWRIGHT_BROWSERS_PATH=$HOME/Library/Caches/ms-playwright` and E2E_* creds (map from TEST_* in .env). Start dev with `WATCHPACK_POLLING=true` + `ulimit -n 10240`. TEST_ADMIN_EMAIL is NOT a platform admin (preview e2e skips).

## Deferred
- Live sanity check of manual lead creation (row + lead_created activity) not done — no-writes rule.
- Backfill of historical `last_action` for ~88 leads from milestone timestamps — declined for now (heuristic; `*_at` are first-set times). Vaidik + Shibajyoti `call_confirmed` and Vaidik `last_action` were backfilled 2026-09-23.
- `logVerificationCallAttempt` (detail page) still doesn't write `last_action`/activity.
- Setter verified "Unqualified" help text says it moves lead to Dead, but `saveLeadActions` doesn't set `is_dead`.
