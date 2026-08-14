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
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (client-visible, but only used for server client init here) | Supabase Project Settings → API |
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
| `ADMIN_EMAIL` | Login email for the dashboard gate | Set in `.env.local` |
| `ADMIN_PASSWORD` | Login password for the dashboard gate | Set in `.env.local` |
| `VIEWER_EMAIL` | Restricted login (Meta Ads / Website / Insights only) | Set in `.env.local` |
| `VIEWER_PASSWORD` | Restricted login password | Set in `.env.local` |
| `ROLE_SECRET` | HMAC key for the signed session cookie | Random hex; required now that there are two roles |
| `WEBSITE_INGEST_SECRET` | Shared secret for runmoreads.in ingest APIs | Random hex; same pattern as `CRON_SECRET` |

## Data ingestion (cron)
- Scheduled pulls are implemented as Next.js Route Handlers under `app/api/cron/*`.
- Vercel Cron configuration is in `vercel.json` (runs hourly to pull “yesterday + today”).
- For local testing, you can run the handlers by calling the route URL and sending an `Authorization` header set to `CRON_SECRET`.

## Website ingest (runmoreads.in)
The marketing site never talks to Supabase. It POSTs to this app with `Authorization: Bearer $WEBSITE_INGEST_SECRET`:
- `POST /api/ingest/lead-form` — qualification form submit (optional `qualified: boolean | null`)
- `POST /api/ingest/booking` — cal.com booking
- `POST /api/ingest/booking-cancelled` — cal.com cancellation relay

These routes are excluded from login middleware (same as cron).

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

