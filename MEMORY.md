# MEMORY

## Commands
- Tests: `npx vitest run` (single file: `npx vitest run <path>`).
- Typecheck: `npx tsc --noEmit` — one pre-existing error in `src/app/authForms.test.tsx` (`beforeEach` not imported).
- Lint: `npx next lint` is not configured (opens interactive ESLint setup). No ruff — repo is TypeScript.
- Read-only live DB: node script with `node --env-file=.env` + supabase-js service role; catalog queries via psql pooler `aws-0-ap-northeast-1.pooler.supabase.com:6543`, user `postgres.<ref>` (direct `db.<ref>` host is IPv6-only).
- DDL / any `SET`: use session-mode pooler port 5432, never session `SET` on 6543 (transaction pooler leaks session state onto shared backends — a `default_transaction_read_only=on` leaked once and had to be reset). zsh: write SQL to a file and use `psql -f`.

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

- "Qualified Call Booked" everywhere (cohort, Home funnel, /meta-ads funnel) = `call_confirmed === true` (`leadReachedCohortStage`). Never `stage` or `action_status`.
- Lead → ad attribution: `createLeadAdResolver` in `src/lib/meta/funnelOutcomes.ts`. facebook and quickform leads carry the ad NAME in `utm_content` (0 match by id), and names like "London 1/2/3" repeat across campaigns. Same-named ads resolve to the highest-spend ad in range.
- `meta_ads_daily.landing_page_views` added and backfilled 2026-09-28 (migration 007, 806 rows, 0 mismatches vs `actions`).
- `call_showed` is manual only. Recordings are Fathom share links (`fathom.video/share/...`). There's no Fathom or cal.com integration or key in `.env`.

- There's no booking activity type. Work Queue "Qualified" sets `call_booked_at` (it keeps an existing cal.com time) along with `call_confirmed`. Self-serve cal.com bookings never write a `call_attempt`. Setter "Calls Booked" = qualified row within 5 min of `call_booked_at`, once per lead (user decision 2026-09-29).
- Filter persistence lives in `table_views.config.filters[orgId]` (user chose no new table). Named saved views should go in another config key. Don't add a `filters` column. `src/lib/leads/listFilterParams.ts` is the single parse/build path for `/leads` URLs. In-app links must keep at least one filter param (e.g. `lifecycle`, `view`), or the restore redirect fires.
- Crons: Vercel Cron in `vercel.json` (UTC schedules). Auth is `assertCronSecret`, and Vercel sends `Authorization: Bearer $CRON_SECRET`. Runs are logged via `logCronRun`. The daily digest `30 14 * * *` (8 PM IST) reuses page query functions. Don't write parallel queries. Test with `?dry_run=1` and don't post to the live webhook.
- The org table is `organizations` (not `orgs`). `profiles` has id, email, role, is_platform_admin, and no name column.

## Deferred
- Leads with null `lead_source` (~77) can't be picked in the Source filter. It needs an `is.null` OR branch in `listLeads`/`countLeads`.
- Saved named views (filters phase 2).
- `logCallAttempt` inserts the `lead_activities` row BEFORE it validates and updates the lead, so failed saves leave leftover rows (e.g. Aishavryaa has 3 extra `qualified` rows on 14 Sep). The user declined the fix for now. This inflates Total Dials slightly.
- Automatic call-showed detection: the proposal is a Fathom webhook that matches the invitee email and sets `call_showed`/`recording_url`. Blocked on the user providing a Fathom API key/webhook secret.
- Ask the website to put the ad ID (`{{ad.id}}`) in `utm_content` so attribution isn't name-based.
- Live sanity check of manual lead creation (row + lead_created activity) not done — no-writes rule.
- Backfill of historical `last_action` for ~88 leads from milestone timestamps — declined for now (heuristic; `*_at` are first-set times). Vaidik + Shibajyoti `call_confirmed` and Vaidik `last_action` were backfilled 2026-09-23.
- `logVerificationCallAttempt` (detail page) still doesn't write `last_action`/activity.
- `leads.form_answers` dropped 2026-09-23 (migration 005); backup `~/Desktop/marketing-rma-backups/leads_form_answers_2026-09-23.csv`.
- `ghl_contact_id` kept (user decision): not a dedup key (Quickform dedups by email → phone → qf-phone placeholder), but it's the only stored Meta lead id.
- `call_cancelled_at`: code + `/api/ingest/booking-cancelled` removed (never fired, 0 rows). Migration 006 drops the column — apply ONLY after that build is deployed.
- `requalification_*` orphaned (UI removed 1a3cc4d); `booking_history` not appended by cal.com or Work Queue reschedule; 8 `call_confirmed=true` leads sit at stage `created`.
- Setter verified "Unqualified" help text says it moves lead to Dead, but `saveLeadActions` doesn't set `is_dead`.
