# Funnel Dashboard
Internal marketing + sales lifecycle dashboard (Meta Ads performance + website/video analytics).

## What this covers right now (Phase 1)
- Home dashboard on `/` (goal ring, KPI strip, paid/organic funnel, trend, leaderboard) from `lifecycleDefinitions` KPIs plus `deal_closed` / `deal_value`.
- CRM at `/leads` for setter/sales to qualify, verify, mark show-up, and close deals.
- Website ingest APIs (`/api/ingest/*`) for runmoreads.in form + cal.com bookings.
- Meta Ads performance and website/video analytics.
- GHL is email sequences only — it does not drive lead status.

## Tech Stack
- Next.js 14 (App Router, TypeScript)
- Tailwind CSS 3.4 (semantic tokens in `globals.css` → `tailwind.config.ts`)
- Inter via `next/font`. No Radix/shadcn — popovers use `@floating-ui/react`.
- Supabase (Postgres) via `@supabase/supabase-js` (service role used server-side only)
- Recharts (themed via CSS variables in `src/lib/ui/chartTheme.ts`)
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
| `SLACK_DEALS_DIGEST_WEBHOOK_URL` | Incoming webhook for the 9 AM IST deal follow-ups digest. If empty, falls back to `SLACK_DAILY_SUMMARY_WEBHOOK_URL`. | Slack app → Incoming Webhooks |

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

### Deal follow-ups digest (`/api/cron/deals-digest`)
- Runs at `30 3 * * *` UTC (9:00 AM IST). Same Vercel Cron + `assertCronSecret` + `cron_runs` path as the 8 PM summary.
- RMA-only today (`getOrgIdBySlug("rma")`). To add orgs, resolve a webhook per org and loop gather + post.
- Posts only when a webhook is set: `SLACK_DEALS_DIGEST_WEBHOOK_URL`, else `SLACK_DAILY_SUMMARY_WEBHOOK_URL`. Never hardcode a webhook URL.
- Open deals come from the Deals list query. Overdue / due today / needs-next-step use `classifyOpenDeal` / `computeDealMetrics` (same as the Deals tab tiles). Needs-next-step is a count only.
- Empty day (nothing overdue and nothing due today): `"No deal follow-ups due today."`
- `?dry_run=1` returns the payload without posting or logging.

### Master AdSpend sheet (`/api/cron/adspend-sheet`)
- Runs at `0 2 * * *` UTC (07:30 IST). Same `assertCronSecret` + `cron_runs` (`job = adspend-sheet`) + first-failure Slack as other daily jobs.
- Independent of the dashboard: reads Tracker names from the hardcoded Master AdSpend spreadsheet (`DEFAULT_ADSPEND_SHEET_ID`; optional `ADSPEND_SHEET_ID` override), fetches account-level spend from Meta Graph `v19.0` with `META_ACCESS_TOKEN`, and upserts Date / Client / Ad Spent (Calls Booked left empty). Does **not** write `ad_accounts` or `meta_ads_daily`.
- Auth is the GA4 service account (`GA4_SERVICE_ACCOUNT_JSON` or `GOOGLE_SERVICE_ACCOUNT_JSON`). Share the sheet with that `client_email` as Editor and keep Tracker names column B as Plain text (16-digit IDs).
- Each run covers yesterday plus the previous 2 IST days (late spend adjustments). Empty B rows are skipped (`no ad account ID`); permission/token errors skip that client (no false ₹0). The run fails only if every account fails.
- Prefers the **Daily Ad Spend** tab when it exists and is plain values. Else if Data is formula-driven, rows go to Feed; otherwise they append/update Data. Idempotent on `(Date, Client)`.
- Backfill: `npx tsx scripts/adspend-sheet-sync.ts --from=2026-11-25 --to=2026-11-25 [--client=Vaidehi] [--dry-run]`. Cron also accepts `?dry_run=1&from=&to=`.

### Cron failure alerts
- `logCronRun` calls `reportCronResult` after every `cron_runs` insert.
- Hourly jobs alert after 3 consecutive errors; daily jobs (`daily-summary`, `deals-digest`, `adspend-sheet`) alert on the first failure. Slack goes to `SLACK_DAILY_SUMMARY_WEBHOOK_URL` (never hardcoded).
- One alert when a job starts failing, then at most once per 24h while it stays down, then `✅ {job} recovered` on the next success. Debounce lives in `cron_alert_state` (migration `010_cron_alert_state.sql` — apply in the SQL editor).
- Meta token expiry (`Error validating access token` / `Session has expired`) uses the copy "Meta access token expired. Reconnect with a long-lived token."
- Admins (org admin or platform admin) see a banner on `/meta-ads` while `meta-ads` is failing or `meta_ads_daily` is more than 2 IST days stale. Home shows spend / cost-per-booked in the KPI strip, or a "Ad data stale since … — reconnect Meta" chip instead of frozen spend.

## Home dashboard (`/`)
- URL filters: `range` (`today` / `7d` / `30d` default / `month` / `all`) and `traffic` (`all` default / `paid` / `organic`). IST-inclusive last day. Goal ring always uses the current calendar month, not the selected range.
- Revenue goal: `organizations.monthly_target` `{ metric: "revenue", value }` (RMA ₹30L / month). Orgs with `NULL` hide the card — no empty-state prompt. Won revenue = `sum(deal_value)` where `deal_closed` and `closed_at` in the month. Null `deal_value` counts as ₹0 and a muted Deals link.
- Paid vs organic is `trafficType()` in `lifecycleDefinitions.ts` (also the custom-filter Traffic field). Funnel, trend, and `/leads?kpi=` deep links share it.
- Funnel steps: Leads → Contacted → Calls booked → Showed → Won. Qualified is a side stat. Bars split paid/organic and scale to Leads. Counts come from `countKpi` / `leadHitsKpiInRange`.
- INR: `formatInr` / `formatInrCompact` in `src/lib/format.ts` (₹5,25,000 / ₹5.25L / ₹1.2Cr).
- Dashboard payload is cached ~60s per org + range + traffic + IST day (`unstable_cache` in `src/lib/db/homeDashboard.ts`).
- Playwright: `e2e/home-dashboard.spec.ts` (URL filters, booked funnel → `/leads`, 1440/1024/768 light+dark, reduced-motion). Screenshots in `e2e/screenshots/home/`.

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
- `/leads` and the Work Queue share one inline-editable grid. The lead name opens a slide-over at `?lead=<id>` (activity, notes, booking history, post-call status + Open in Deals, follow-ups). `/leads/[id]` redirects there. Slack links use `?lead=`. Open/close is client state; the URL is updated with `history.pushState` / `replaceState` (Next 14.2, no RSC refetch). Close is instant (overlay, Esc, Close). Session-cached drawer payloads; activity skeletons when switching uncached leads. Notes wrap (`overflow-wrap: anywhere`); the drawer never scrolls horizontally.
- Failed lifecycle actions and field saves toast bottom-left (`Toaster` in the app shell): lead name + message, 4s, max 3 stacked, dismissible. Soft-warning confirms stay as popovers. Routine cell saves stay silent (optimistic UI). Stage Actions and the Showed Up cell disable choices `planLifecycle` would reject (tooltip = the block reason); the toast is the safety net if one still fires.
- Action popovers (Log call, Stage Actions, confirm, book/reschedule, Note) use `ActionPopover` (`@floating-ui/react`): portal to `document.body`, flip/shift to stay on screen, internal scroll with pinned Save/Cancel.
- Vercel functions run in Tokyo (`hnd1` in `vercel.json`) to match Supabase `ap-northeast-1`.
- `pipeline_stage` is a Postgres generated column (new → contacted → qualified → call_booked → showed_up; dead is the separate `is_dead` overlay). Never write it. `updateLead` sends only changed columns.
- `setter_verified*`, `call_confirmed`, `action_status`, and `lifecycle_status` are no longer written or read (columns kept for a week of verification).
- `/api/ingest/booking` logs a `schedule` activity on a lead's first booking. Repeat bookings update the time quietly; reschedules and cancellations are logged from the dashboard only.
- `mark_showed` through `updateLeadLifecycle` sets `owner_id` to the actor when it is still null (same `apply_lead_change` call). Showups from scripts/imports stay unassigned.

## Deal writes
A deal is a lead with `call_showed = true`. Pipeline fields live on `leads` (`deal_closed`, `post_call_status`, `next_step`, `next_action_at`, `owner_id`, `deal_value`, `lost_reason`, `closed_at`, `closed_by`). No separate table.
- UI/server writes go through `updateDeal` → `planDeal` (`src/lib/deals/dealLifecycle.ts`, pure, shared with optimistic UI) → `apply_lead_change`. Org-preview is read-only. No overrides. `is_dead` is ignored (pre-call flag).
- Actions: `log_follow_up`, `set_next_step`, `change_stage`, `assign_owner`, `set_value`, `mark_won`, `mark_lost`, `reopen`. Open deals must have a next step after the first follow-up; new/backfilled deals sit in "Needs next step" until then. Stages: null = Showed up, `follow_up_call_booked`, `awaiting_lead_response`, `contract_shared` (label: Proposal sent), `awaiting_payment`.
- The lead drawer Post-call section is read-only (status line + Open in Deals). Recording URL stays editable there. Won/lost/stage/next-step edits do not go through `saveLeadActions`.

## Deals (`/deals`)
A deal is a showed lead (`call_showed = true`). There is no deals table. Open / Won / Lost = `deal_closed` NULL / true / false.
- Sidebar link sits between Work Queue and Insights. A red badge is the org's overdue open deals (`next_action_at < now`); hidden at 0.
- Default tab is Open (all-time; an open deal never drops off because it is old). Won / Lost / All default to the last 60 IST days (`closed_at` for Won/Lost, `call_showed_at` for All). Tab counts are all-time for the current org.
- Open is grouped in IST: Overdue (oldest first, red), Needs next step (showed desc, amber), Today, Tomorrow, This week (rest of the week), Later. Empty groups are hidden. Row click opens `?deal=` (same instant drawer as `?lead=`: pushState open, replaceState close, no list refetch). Hover: Log follow-up + ⋯ (stage, owner, won, lost). Lost rows have Reopen.
- Log follow-up is a popover and the top of the drawer. Writes go through `dealAction` → `updateDeal`. Optimistic grouping; a server error rolls the row back and toasts the lead name. `Cmd/Ctrl + Enter` saves. A past next-step time needs a confirm checkbox.
- Custom filter builder is the Work Queue one; Next step and Lost reason are registered fields. Owner / Stage / Showed-up (or Closed) date / Sort sit on the toolbar. Last-used filters persist under `table_views.config.filters[orgId]` with page key `deals` (`?deal=` is a deep link and is not saved).
- Org-preview is read-only (no hover actions; `requireWritableOrgId` rejects writes).
- Not in this version: board/kanban, email/calendar sync, multi-deal per lead.

## Leads / Work Queue filters
- Every filter is in the URL. Source and Stage are checkbox multi-selects written as comma-separated params (`?source=youtube,youtubemokshvideo`); repeated params are accepted too. OR within a field, AND across fields. Stage is the five `pipeline_stage` values. Dead is hide / show / only. Follow-up is overdue / today / upcoming (IST, render-time). Search `q` (Work Queue: `search`) is the URL; the input re-syncs on back/forward and saved-view restore. Typing debounces ~300ms with `router.replace`; Enter commits immediately with `router.push`. A spinner + dimmed table (`useTransition`) shows while results refresh. An explicit `q` in the URL wins over saved-filter restore.
- Custom filters (`?cf=` compact base64url JSON) sit on the same query path. Filter / a chip / "+ Add filter" opens a popover (`ActionPopover`) with Match all/any and condition rows. A complete condition applies after ~300ms — no Apply button. Incomplete rows are ignored. "Is not" / "does not contain" / "is none of" include blanks. Work Queue drops hide-dead (and the form-unqualified hide) when a condition uses Deal, Dead, or Dead reason, and drops hide-form-unqualified when it uses Form Qualified (a note appears under the chips). JSON `custom_fields` filters may seq-scan; that's fine at ~2k leads. Live SQL checks: `LIVE_DB=1 npx vitest run src/lib/leads/customFilter.live.test.ts`.
- Named views live in `table_views.config.namedFilters[orgId]` (not a new column). Views → Save current view… stores the current URL (quick filters + `cf` + sort). Shared-with-team views are admin-only to edit; everyone in the org can apply them. RMA is seeded with "Lost — reactivate" and "Showed — awaiting response or contract" (the Showed view is empty on the Work Queue after the Deals split; it still works on `/leads`). Explicit URL params still win over last-used state.
- Work Queue (`/leads/queue`): All is the default tab (full calling queue: not dead; form-unqualified hidden unless the popover toggle is on, or a custom filter yields those bases). **Showed leads (`call_showed = true`) are excluded from every Work Queue tab, count, and custom filter** — they belong on Deals. `/leads` is unchanged and still lists them. Meetings booked and Follow-ups sit to its right as underline tabs. Sort is server-side (`?sort=newest|oldest|follow_up`; newest = `created_at` desc, the default on every tab; oldest = `created_at` asc; follow-up due = `next_action_at` asc, nulls last). Changing tab, filter, sort, search, or custom filter uses the same pending spinner / dimmed list. Sort is remembered in the saved view; an explicit `?sort=` wins. One toolbar holds search, Filter, Sort, Views, Cards/Table, and Create Lead (Columns only in Table). `/leads` uses the same toolbar and chip row without Work Queue tabs. Email and phone use the same `CopyValue` control as `/leads` (hover/focus on desktop; copies the stored value; checkmark for 1.5s).
- Chips are the source of truth for active filters (custom conditions, form-unqualified, leftover `filter=` status, /leads Source/Stage/…). × removes one; click a custom chip to edit it in the popover. "Where all of / any of" appears with 2+ custom conditions. Save view and Clear are text links. Clear resets `/leads` to `?dead=hide` (rolling last 30 days).
- Each user's last-used filters are remembered per page and per org in `table_views.config.filters[orgId]` (alongside `columns`). Opening `/leads`, `/leads/queue`, or `/deals` with no filter params redirects to them. Any explicit filter param (shared links, kpi/cohort/event links, `cf`, `?deal=`) wins. KPI/cohort/event/`?lead=`/`?deal=` deep links are never saved. Old saved `lifecycle` / `action_status` keys are rewritten on restore.
- The rolling default date range isn't saved as fixed dates. Resetting columns keeps saved filters and named filters.

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

## Design tokens
Colours, radius, type and shadows live in `src/app/globals.css` (`:root` / `[data-theme="light"]`, `[data-theme="dark"]`). Components use `bg-surface`, `text-muted`, `border-subtle`, `bg-accent` — never raw hex. Lime `--accent` is one line to swap. Review every kit piece at `/dev/ui` (public, not in the nav). Sidebar collapse is stored in `localStorage` (`sidebar-collapsed`).

Theme is Light / Dark / System (default System). The sidebar toggle writes `localStorage` key `theme` (try/catch) and a `theme` cookie so the root layout can SSR `data-theme`. A blocking `<head>` script applies the resolved theme before first paint and follows `prefers-color-scheme` when System is selected. Dark mode uses borders, not shadows.

Motion presets live in `src/lib/motion.ts` (`fast` 120ms, `base` 200ms, `slow` 750ms, easing `[0.22, 1, 0.36, 1]`). Kit pieces use the `motion` package; simple hovers stay CSS. `prefers-reduced-motion` disables count-ups, entrance, shimmer and shake (opacity fades ≤150ms only). Drawers animate on open and unmount immediately on close. Entrance wrappers (`FadeIn` / `EnterStagger`) always animate **to** `opacity: 1` on mount and stay visible if the first-enter key was already consumed — never `useAnimationControls()` with a `set(hidden)` that might not start. Playwright has a `chromium-reduced-motion` project; `e2e/visual-integrity.spec.ts` runs with motion **on** and checks effective opacity plus contrast.

## Project structure
- `src/app/` : App Router pages (`/`, `/meta-ads`, `/website`, `/dev/ui`) and route handlers
- `src/components/ui/` : token-based kit (Card, Stat, Segmented, Button, …)
- `src/lib/db/` : Supabase data-access helpers per table (`meta_ads_daily`, `website_daily`, `cron_runs`, `homeDashboard`)
- `src/lib/home/` : Home range/traffic, pace, INR-facing assemble
- `src/lib/leads/` : Stage computation used by every lead write (`trafficType` lives here)
- `src/components/home/` : Home dashboard cards
- `src/app/api/ingest/` : Website form/booking ingest (Bearer `WEBSITE_INGEST_SECRET`)
- `supabase/migrations/` : SQL migrations (including ad-level Meta grain)
- `src/app/api/cron/` : Cron-protected scheduled pull endpoints for Meta, GA4, and Wistia
- `scripts/backfill.ts` : One-off historical backfill (manual, not scheduled)

## Deployment
- This app is intended for Vercel.
- Set environment variables in the Vercel project settings (not only locally).
- Cron jobs only run in the deployed environment (not during `next dev`).

