# Funnel Dashboard
Internal marketing + sales lifecycle dashboard (Meta Ads performance + website/video analytics).

## What this covers right now (Phase 1)
- Funnel overview on `/` from the `leads` table (system of record for status).
- CRM at `/leads` for setter/sales to qualify, verify, mark show-up, and close deals.
- Website ingest APIs (`/api/ingest/*`) for runmoreads.in form + cal.com bookings.
- Meta Ads performance and website/video analytics.
- GHL is email sequences only — it does not drive lead status.

## Tech Stack
- Next.js 14 (App Router, TypeScript)
- Tailwind CSS
- Supabase (Postgres) via `@supabase/supabase-js` (service role used server-side only)
- Recharts (simple line charts)
- Deployed on Vercel with Vercel Cron for scheduled data pulls

## Getting started locally
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in real values.
3. Create the Supabase schema (tables live in your Supabase project). Run `supabase/migrations/001_meta_ads_ad_level.sql` and `supabase/migrations/002_leads.sql` in the SQL editor.
4. Run: `npm run dev`

### Environment variables
Create `.env.local` locally from `.env.example`. This file is never committed.

| Variable | Used for | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key (browser + SSR auth) | Supabase Project Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) | Supabase Project Settings → API |
| `META_APP_ID` | Meta Marketing API app id | Meta Developers → Your app |
| `META_APP_SECRET` | Meta Marketing API app secret | Meta Developers → Your app |
| `META_ACCESS_TOKEN` | Long-lived Meta access token with ads_read | Meta app → Marketing API token |
| `META_AD_ACCOUNT_ID` | Meta Ad Account id (e.g. `act_123...`) | Meta Ads Manager → Ad Account |
| `GA4_PROPERTY_ID` | GA4 property id | GA4 Admin → Property settings |
| `GA4_SERVICE_ACCOUNT_JSON` | Google service account JSON (stringified) with Viewer access to GA4 | GCP → Service Accounts → key; also ensure Data API enabled |
| `WISTIA_API_TOKEN` | Wistia API token | Wistia → Settings → API Access |
| `WISTIA_MEDIA_ID` | Wistia media id (hashed id) | Wistia → video/media settings |
| `CRON_SECRET` | Shared secret to protect cron routes | Choose any strong value |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `VIEWER_*` / `ROLE_SECRET` | Legacy shared-password auth (unused once Supabase Auth is live; keep briefly for rollback) | — |
| `WEBSITE_INGEST_SECRET` | Shared secret for runmoreads.in ingest APIs | Random hex; same pattern as `CRON_SECRET` |
| `SLACK_DAILY_SUMMARY_WEBHOOK_URL` | Incoming webhook for the 8 PM IST daily digest | Slack app → Incoming Webhooks |

### Auth (Supabase Auth)
- Sign-in uses Supabase email/password (`profiles.role` = `admin` | `viewer`).
- Create users in Supabase Dashboard → Authentication → Users (no public sign-up).
- After create, set admins with: `update profiles set role = 'admin' where email = '…';`
- Viewers remain limited to `/meta-ads`, `/website`, `/insights`.

## Data ingestion (cron)
- Scheduled pulls are implemented as Next.js Route Handlers under `app/api/cron/*`.
- Vercel Cron configuration is in `vercel.json` (runs hourly to pull “yesterday + today”).
- For local testing, you can run the handlers by calling the route URL and sending an `Authorization` header set to `CRON_SECRET`.

### Daily Slack digest (`/api/cron/daily-summary`)
- Runs at `30 14 * * *`. Vercel cron is UTC, so that's 8:00 PM IST. It posts a Block Kit summary for today in IST, labelled "today so far, as of <time> IST".
- Setter lines use `getSetterActivityReport`, the same function as `/insights` Setter activity.
- Ad spend uses `getMetaAdsTotals` (same as `/meta-ads`) and is only as fresh as the last hourly Meta sync (noted in the message).
- Leads received and calls booked use `countLeads`, the same as `/leads?lifecycle=all` and `/leads?event=call_booked` for today. The message flags when leads booked today differs from setter-call bookings.
- `?dry_run=1` returns the numbers and payload without posting: `curl -H "Authorization: Bearer $CRON_SECRET" ".../api/cron/daily-summary?dry_run=1"`.

## Website ingest (runmoreads.in)
The marketing site never talks to Supabase. It POSTs to this app with `Authorization: Bearer $WEBSITE_INGEST_SECRET`:
- `POST /api/ingest/lead-form` — qualification form submit (optional `qualified: boolean | null`). The website's verdict is stored in `form_qualified` only. `qualified` / `qualified_at` / `qualified_by` are the setter's decision, and ingest never writes them.
- `POST /api/ingest/booking` — cal.com booking

These routes are excluded from login middleware (same as cron).

## Manual leads (Work Queue → Create Lead)
Referrals and hand-entered leads are created from the Work Queue (blocked during org preview).
- `lead_source` is one of `referral`, `manual`, `other` — never an ingest value, so they are not ad-attributed.
- Email is optional; blank uses a `manual-phone-<digits>@manual.invalid` placeholder (shown as "No email").
- Duplicates are rejected by org email and phone digits (same keys as ingest).
- The creator is recorded as a `lead_activities` row (`type = lead_created`, `created_by` → `profiles.id`).

## Lead lifecycle writes
Spec: `docs/lead-lifecycle-spec.md`. Every milestone from the UI goes through `updateLeadLifecycle(leadId, action, payload, actor)` (`src/lib/leads/updateLeadLifecycle.ts`).
- Order: `requireWritableOrgId`, validate (`planLifecycle` in `src/lib/leads/lifecycle.ts`, pure and shared with the Work Queue's optimistic UI), then lead update + `lead_activities` rows in one transaction via the `apply_lead_change` Postgres function (migration 009).
- Actions: `log_call_attempt`, `qualify`, `disqualify`, `clear_qualification`, `book_call`, `reschedule_call`, `cancel_call`, `mark_showed`, `mark_no_show`, `clear_show`, `mark_dead`, `revive`, `set_follow_up`. Work Queue "Qualified" = `qualify` + `book_call` in one step.
- Hard blocks (no overrides): `book_call` needs `first_contacted_at` (cal.com / Quickform ingestion exempt); `mark_showed` needs `call_booked_at`. Clearing a milestone needs a reason.
- `disqualify` and `mark_no_show` also mark the lead dead (`dead_reason` `not_qualified` / `no_show`). Dead reason codes: `not_qualified`, `no_show`, `no_answer`, `not_interested`, `other`; older free-text reasons are shown via `deadReasonLabel`.
- Plain field edits (notes, deal value, custom fields) use `updateLeadFields` and log one `field_edited` activity with the changed keys. Name, phone and email are locked. Inline "Call scheduled" edits route to `book_call` / `reschedule_call`.
- `/leads` and the Work Queue share one inline-editable grid. The lead name opens a slide-over at `?lead=<id>` (activity, notes, booking history, post-call, follow-ups). `/leads/[id]` redirects there. Slack links use `?lead=`. Open/close is client state; the URL is updated with `history.pushState` / `replaceState` (Next 14.2, no RSC refetch). Close is instant (overlay, Esc, Close). Session-cached drawer payloads; activity skeletons when switching uncached leads. Notes wrap (`overflow-wrap: anywhere`); the drawer never scrolls horizontally.
- Failed lifecycle actions and field saves toast bottom-left (`Toaster` in the app shell): lead name + message, 4s, max 3 stacked, dismissible. Soft-warning confirms stay as popovers. Routine cell saves stay silent (optimistic UI). Stage Actions and the Showed Up cell disable choices `planLifecycle` would reject (tooltip = the block reason); the toast is the safety net if one still fires.
- Action popovers (Log call, Stage Actions, confirm, book/reschedule, Note) use `ActionPopover` (`@floating-ui/react`): portal to `document.body`, flip/shift to stay on screen, internal scroll with pinned Save/Cancel.
- Vercel functions run in Tokyo (`hnd1` in `vercel.json`) to match Supabase `ap-northeast-1`.
- `pipeline_stage` is a Postgres generated column (new → contacted → qualified → call_booked → showed_up; dead is the separate `is_dead` overlay). Never write it. `updateLead` sends only changed columns.
- `setter_verified*`, `call_confirmed`, `action_status`, and `lifecycle_status` are no longer written or read (columns kept for a week of verification).
- `/api/ingest/booking` logs a `schedule` activity on a lead's first booking. Repeat bookings update the time quietly; reschedules and cancellations are logged from the dashboard only.

## Leads / Work Queue filters
- Every filter is in the URL. Source and Stage are checkbox multi-selects written as comma-separated params (`?source=youtube,youtubemokshvideo`); repeated params are accepted too. OR within a field, AND across fields. Stage is the five `pipeline_stage` values. Dead is hide / show / only. Follow-up is overdue / today / upcoming (IST, render-time). Search `q` (Work Queue: `search`) is the URL; the input re-syncs on back/forward, chip remove, Clear all, and saved-view restore. Typing debounces ~300ms with `router.replace`; Enter commits immediately with `router.push`. A spinner + dimmed table (`useTransition`) shows while results refresh. An explicit `q` in the URL wins over saved-filter restore.
- Chips above the table mirror the panel. × removes one filter; "Clear all" resets to `/leads?dead=hide` (rolling last 30 days).
- Each user's last-used filters are remembered per page and per org in `table_views.config.filters[orgId]` (alongside `columns`). Opening `/leads` or `/leads/queue` with no filter params redirects to them. Any explicit filter param (shared links, kpi/cohort/event links) wins. KPI/cohort/event deep links are never saved. Old saved `lifecycle` / `action_status` keys are rewritten on restore.
- The rolling default date range isn't saved as fixed dates. Resetting columns keeps saved filters.

## Meta Ads → Funnel by ad (`/meta-ads`)
Table above the trend charts, campaign → ad set → ad, same date range as the page.
- Ads are classified by the `lead_source` of every lead ever attributed to them (same `utm_content` → ad id, then ad name resolver as the Campaigns table): `facebook` = landing page, `quickform_fb`/`quickform_ig` = Quickform. Other sources are ignored.
- LP visitors = `meta_ads_daily.landing_page_views` (extracted from `actions` at ingest).
- Landing-page-only metrics: opt-ins = `created_at` in range; form-qualified opt-ins = `form_qualified = true` (same timestamp).
- Calls Booked / Showups / Qualified Showups use `lifecycleDefinitions` KPIs (milestone timestamp in range, same as Home, Slack, and `/leads?kpi=`). Quickform ads count bookings and showups too.
- Cost = the row's adspend ÷ count. A dash means the metric doesn't apply to that ad type, or the count is zero (for cost).

## Insights → Setter activity (`/insights`)
Org-level daily table plus a per-setter table (their totals must match) from `lead_activities` rows with `type = 'call_attempt'`. Rows are bucketed by the IST day they were logged and grouped by `created_by` → `profiles.email`.
- Total Dials = every row, repeats included. No Answer / Unqualified / Follow-up = outcome `no_answer` / `not_qualified` / `follow_up_needed`.
- Calls Booked = bookings made on the call: an outcome `qualified` whose lead's `call_booked_at` is within 5 minutes of the row, counted once per lead. It excludes qualify calls on leads who had already booked on cal.com, and leftover rows from failed saves.

## Backfilling historical data
The hourly cron routes only pull the last 2 days. For a one-time all-time backfill, use the manual script:

```bash
npm run backfill -- --source=all --from=2024-01-01 --confirm
```

Options:
- `--source=meta|ga4|wistia|all` — run one source at a time or all (default: `all`)
- `--from=YYYY-MM-DD` — start date inclusive (**defaults to 1 year ago** if omitted)
- `--to=YYYY-MM-DD` — end date inclusive (defaults to today)
- `--confirm` — skip the interactive confirmation prompt (required in non-interactive shells)
- `--truncate` — delete existing `meta_ads_daily` rows before a Meta reload (use when changing grain)

The script requests data in **monthly chunks** with retry/backoff, upserts into `meta_ads_daily` (unique on `date, ad_id`) and `website_daily`, and prints a summary when done. Upserts are idempotent, so re-running is safe but uses API quota.

**Wistia note:** historical daily play counts come from Wistia’s Stats `by_date` endpoint. Average watch % and form metrics are only populated by the hourly cron going forward (Analytics API, per-day).

After changing Meta grain from ad set to ad, re-run Meta only (not GA4/Wistia):

```bash
# 1. Run supabase/migrations/001_meta_ads_ad_level.sql in the Supabase SQL editor
# 2. Reload Meta history at ad level
npx tsx --env-file=.env.local scripts/backfill.ts --source=meta --from=2020-01-01 --truncate --confirm
```

This script is **not** scheduled in `vercel.json` — run it manually once from your machine.

## Project structure
- `src/app/` : App Router pages (`/`, `/meta-ads`, `/website`) and route handlers
- `src/lib/db/` : Supabase data-access helpers per table (`meta_ads_daily`, `website_daily`, `cron_runs`)
- `src/lib/leads/` : Stage computation used by every lead write
- `src/app/api/ingest/` : Website form/booking ingest (Bearer `WEBSITE_INGEST_SECRET`)
- `supabase/migrations/` : SQL migrations (including ad-level Meta grain)
- `src/app/api/cron/` : Cron-protected scheduled pull endpoints for Meta, GA4, and Wistia
- `scripts/backfill.ts` : One-off historical backfill (manual, not scheduled)

## Deployment
- This app is intended for Vercel.
- Set environment variables in the Vercel project settings (not only locally).
- Cron jobs only run in the deployed environment (not during `next dev`).

