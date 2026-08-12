# Funnel Dashboard
Internal marketing + sales lifecycle dashboard (Meta Ads performance + website/video analytics).

## What this covers right now (Phase 1)
- Meta Ads performance: spend, CTR, CPC, and leads (blended cost/lead) with simple trends and sortable campaign/ad-set table.
- Website & video analytics: landing page visits, video plays, watch metrics, and form completion rates (site-wide totals for now).
- Lead lifecycle tracking via GHL webhook is a later phase and is not built yet.

## Tech Stack
- Next.js 14 (App Router, TypeScript)
- Tailwind CSS
- Supabase (Postgres) via `@supabase/supabase-js` (service role used server-side only)
- Recharts (simple line charts)
- Deployed on Vercel with Vercel Cron for scheduled data pulls

## Getting started locally
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in real values.
3. Create the Supabase schema (tables live in your Supabase project; see your schema/SQL in Supabase).
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

## Data ingestion (cron)
- Scheduled pulls are implemented as Next.js Route Handlers under `app/api/cron/*`.
- Vercel Cron configuration is in `vercel.json` (runs hourly to pull “yesterday + today”).
- For local testing, you can run the handlers by calling the route URL and sending an `Authorization` header set to `CRON_SECRET`.

## Project structure
- `src/app/` : App Router pages (`/`, `/meta-ads`, `/website`) and route handlers
- `src/lib/db/` : Supabase data-access helpers per table (`meta_ads_daily`, `website_daily`, `cron_runs`)
- `src/app/api/cron/` : Cron-protected scheduled pull endpoints for Meta, GA4, and Wistia

## Deployment
- This app is intended for Vercel.
- Set environment variables in the Vercel project settings (not only locally).
- Cron jobs only run in the deployed environment (not during `next dev`).

