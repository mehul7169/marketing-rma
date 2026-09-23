# PROJECT_STATE_AUDIT

**Captured:** 2026-09-22  
**Live instance walked:** `https://tracking.runmoreads.in` (Playwright MCP)  
**Code cross-ref:** current `main` workspace  
**Roles exercised:** RMA org member (non–platform-admin) · platform admin · org preview of **Moksh** and **Experto Labs**

This document describes **what the app actually does today**, not historical planning intent. The referenced planning file `lead-lifecycle-map-and-user-stories.md` (and any archive copies) **are not present in this repo**; README claims that contradict live behavior are called out under [Doc drift](#doc-drift).

---

## How to read this

- **Org-scoped pages** (`/`, `/leads`, `/leads/queue`, `/insights`, `/meta-ads`, `/website`) use the signed-in user’s membership org, or a platform admin’s **org preview** cookie (`preview_org_id`).
- **Platform-admin pages** (`/clients-ads*`, `/admin/organizations*`) require `profiles.is_platform_admin`.
- **`profiles.role` (`admin` | `viewer`) is not used for route or nav gating** in live code (despite README). Invite UI still collects a role; it does not limit which nav items appear.
- Org preview is **read-only**: banner + mutation guard (`requireWritableOrgId`). Work Queue shows “Read-only preview — exit org preview to make changes.”

---

## Auth & shell (live)

| Capability | Who | Behavior observed |
|---|---|---|
| Org nav: Home, Leads, Work Queue, Insights, Meta Ads, Website | Member **or** admin with active preview | Present for RMA member; present for admin |
| Client Ads | Platform admin only | Hidden from RMA member; redirects member away from `/clients-ads` → Home |
| Organizations | Platform admin only | Same |
| Org preview switcher | Platform admin only | Lists all orgs; “Exit preview” clears cookie |
| Login | Supabase email/password | Legacy `.env` `ADMIN_*` / `VIEWER_*` **do not work** against production Auth |

**Orgs in production (sample):** RMA (`rma`), Experto Labs, Moksh, plus many client orgs created for Client Ads (most have **0 members**).

---

## Page / feature inventory

### `/` — Home (Funnel overview)

- **Purpose:** Org cohort funnel + headline rates for a date range.
- **Who:** Any org member (or admin previewing an org). Data is org-scoped — RMA shows hundreds of leads; Moksh preview showed **0** CRM leads; Experto has a full Quickform-driven funnel.
- **Actions:** Date range (From/To IST + Update); source chips (All + distinct `lead_source` values); lifecycle pulse links (Active / Unqualified / Dead / Closed); funnel stage cards; deep links to Insights / Leads / Meta Ads / Website.
- **Data:** **R** `leads` (`listLeadsInRange`, distinct sources). **W** none.
- **Live notes (RMA):** ~377 leads in last 30d; sources include `facebook`, `ig`, `quickform_fb`, `quickform_ig`, `youtube`, `youtubemokshvideo`.

### `/leads` — Leads CRM list

- **Purpose:** Browse/filter the CRM lead table; jump to detail or Work Queue.
- **Who:** Org member / preview. Filters and column prefs are per-user via `table_views`.
- **Actions:** Date range; lifecycle tabs (Active / Unqualified / Dead / Closed / All); Follow-ups Due; Needs Verification Call; source shortcuts (All / Meta Ads / YouTube) + multi-select sources; search; action_status; Dead?; Stage multi-select; Column picker (visibility / order / width — persists to `table_views`); row open → `/leads/[id]`; link to Work Queue; pagination.
- **Data:** **R** `leads`, `lead_reminders` (due counts), `organizations`, `table_views`. **W** `table_views` only on this page.
- **Live notes:** Experto leads often use synthetic emails `qf-phone-…@quickform.invalid` (phone-only Quickform upserts). RMA has many phones stored with a literal `p:` prefix (~188 rows) — display noise.

### `/leads/queue` — Work Queue

- **Purpose:** Active calling queue (hides dead/closed) with inline CRM actions.
- **Who:** Org member (writable); preview (read-only chrome).
- **Tab / filter model (live):**
  - Tabs: **Meetings Booked** (count badge), **Follow-ups Due** (badge) — URL `?tab=meetings_booked|follow_ups_due`.
  - Status filter select: All active / Untouched / Personally Contacted / Upcoming — intended to be disabled while a tab is active.
  - View toggle: Cards | Table (`?view=cards|table`).
  - Search (name/email/phone); Column picker; pagination.
- **Row / card actions (stage-driven):** Note; Log Call (outcomes: no answer / follow-up needed / qualified + schedule); Qualify Call; Log Outcome (show); Reschedule; WhatsApp nudge (logs activity only — **no WhatsApp API**); View history; inline edit of name/email/phone/notes/schedule/custom fields (when writable).
- **Data:** **R** `leads`, `lead_activities`, `organizations`, `table_views`. **W** `leads`, `lead_activities`, `lead_reminders` via `src/app/leads/actions.ts`.
- **Live notes (RMA):** Meetings Booked = 1; Follow-ups Due = 33. Experto preview: Meetings Booked = 3; Follow-ups Due = 14; actions replaced by read-only message.

### `/leads/[id]` — Lead detail

- **Purpose:** Full record + Before/After call CRM + follow-ups.
- **Who:** Same org scope; preview disables edits.
- **Actions observed:** Qualified tri-state; Setter verified; Schedule call (datetime + Save); Reminder sent On/Off; Call showed tri-state; Deal Won/Lost; Notes + Save; Add follow-up (text + optional due); Campaign & technical details / Form Details sections; copy helpers; Work Queue / ← Leads links. Verification-call attempt UI exists in code (`LeadActions`) for booked flows; not all states surface every control.
- **Data:** **R/W** `leads`, `lead_reminders`, `lead_activities` via lead actions (`requireWritableOrgId`).

### `/insights`

- **Purpose:** Funnel rate cards + creative performance (Meta spend × lead outcomes) + source→booked + daily trend.
- **Who:** Org member / preview.
- **Actions:** Date range; multi-select sources; sortable creative table.
- **Data:** **R** `leads` + `meta_ads_daily` (join on **`utm_content` ↔ `ad_name`**, name match — not IDs). **W** none.
- **Live notes (RMA):** “Unmatched leads: **157**” called out in UI. Moksh: spend creatives present, all funnel outcome cols 0 (no CRM leads).

### `/meta-ads`

- **Purpose:** Org Meta hierarchy (campaign → ad set → ad) with optional funnel columns for **lead-source** accounts.
- **Who:** Org member / preview. Empty/partial if org has no usable Meta linkage.
- **Actions:** Date range; expand rows; column sort; Columns preset (Standard / RMA Performance Tracking, localStorage).
- **Data:** **R** `ad_accounts` (org), `meta_ads_daily`, `leads` (funnel attach). **W** none.
- **Live notes:** RMA and Experto show funnel columns. Moksh shows Meta spend + Meta-reported leads but **0** Form Filled/Booked (no CRM). Same unmatched-lead tip as Insights.

### `/website`

- **Purpose:** Landing-page / video daily analytics (GA4 + Wistia → `website_daily`).
- **Who:** Org member / preview. **Practically RMA-only data** (crons hard-scope RMA).
- **Actions:** Date range; “Break down by source” checkbox **disabled** (“until GA4 captures UTMs”).
- **Data:** **R** `website_daily`. **W** none (writes via cron).
- **Live notes:** RMA shows large totals but the daily table renders **many duplicate rows per calendar day** (see QA). Moksh: “No data in this date range yet.”

### `/clients-ads` + `/clients-ads/[id]` — Client Ads (platform admin)

- **Purpose:** Cross-org **non–lead-source** Meta accounts; monitoring without CRM funnel columns. RMA lead-source stays on `/meta-ads`.
- **Who:** Platform admin only.
- **Actions (list):** Add Ad Account (Meta ID + existing org or create org); row → detail. Status / yesterday lead counts with ⚠ markers on some rows.
- **Actions (detail):** Edit display name; Delete account; date range; expand/sort/column preset; Meta ID read-only.
- **Data:** **R/W** `ad_accounts`, **R** `meta_ads_daily`, `cron_runs`, `organizations`. Add via `/api/clients-ads/accounts` (optional org create + backfill).

### `/admin/organizations` + `/admin/organizations/[id]`

- **Purpose:** Create orgs; invite members.
- **Who:** Platform admin only.
- **Actions:** Create organization (name, slug); open org; Invite member (email + role admin|viewer). Members table (read-only status).
- **Data:** **R/W** `organizations`, `memberships`, `profiles`.
- **Live notes:** Most client orgs have **0 members** — they exist so Client Ads / preview can bind an `org_id`. Invite “role” is stored but does not gate nav (platform admin flag does).

### Auth pages

- `/login` — email/password → Supabase session cookie → `/`.
- `/signup` — invite-gated sign-up (not deeply exercised in this pass).

---

## User stories (from live behavior)

### Org member (RMA)

1. As a **setter**, I want a **Work Queue** of active leads with Meetings Booked / Follow-ups Due tabs, so that I call the right people first without scanning Dead/Closed.
2. As a **setter**, I want to **log call outcomes inline** (no answer / follow-up / qualified + schedule), so that `action_status`, attempts, and next action update without opening every detail page.
3. As a **setter**, I want **lead detail** Before/After call controls (qualify, verify, schedule, show, close, notes, follow-ups), so that lifecycle columns stay the system of record.
4. As a **marketer**, I want **Home / Insights / Meta Ads** cohort views for the last 30 days, so that I see booked/show/close rates against spend and creatives.
5. As a **marketer**, I want **Website** daily visits and video plays, so that I can track top-of-funnel traffic (RMA property only today).
6. As any **member**, I want **saved table columns** on Leads / Work Queue, so that my layout persists across sessions.

### Platform admin

7. As a **platform admin**, I want an **org preview switcher**, so that I can inspect each client’s CRM/Meta UI without joining as a member (read-only).
8. As a **platform admin**, I want **Client Ads** list + detail (no funnel columns), so that I monitor client Meta accounts separately from RMA’s lead-source dashboard.
9. As a **platform admin**, I want to **create orgs and invite members**, so that new clients can get memberships when needed.
10. As a **platform admin**, I want Client Ads add-account to **create an org shell** when needed, so that Meta data has an `org_id` even before anyone logs in.

### Client-org patterns (observed)

11. As an **Experto** operator (via preview), I want Quickform-ingested phone-only leads in Leads/Queue/Meta, so that calling works without website forms.
12. As someone viewing **Moksh**, I want Meta performance even with **zero CRM leads**, so that ads-only clients still have a dashboard (via preview or future membership).

---

## Data flow

### 1. Quickform (Google Sheets Apps Script) → `POST /api/ingest/quickform-lead` → `leads` / `custom_fields` → Leads / Work Queue

| Step | Behavior |
|---|---|
| Auth | Quickform ingest secret |
| Org | `org_slug` → org id; unknown → soft skip |
| Match | Email upsert; else phone match; phone-only insert uses `qf-phone-…@quickform.invalid` |
| Structural | name/phone/UTMs (with Meta name aliases), `ad_set_id`, `ghl_contact_id`←sheet `id`, `lead_source`←`quickform`/`quickform_<platform>`, `form_filled_at`←`created_time` |
| Custom | All non-structural keys as-is (expects long-form question keys) |
| Status seed | reject → `qualified=false`; “call booked” → booking fields |

**UI:** Leads + Work Queue + Home funnel (Experto heavily; RMA also receives Quickform IG/FB).

### 2. RMA website form → `POST /api/ingest/lead-form` → `leads` → same UI

| Step | Behavior |
|---|---|
| Auth | Website ingest secret |
| Org | **Hard-coded** `rma` |
| Match | Email only |
| Custom fields | Legacy short aliases mapped to **same four long Quickform keys** (`src/lib/leads/customFields.ts`) — **aligned after recent fix** |
| Qualified | Explicit bool; `qualified_by="form"` |

**Related:** `POST /api/ingest/booking` (+ cancelled) — cal.com → booking columns on RMA leads (hard-coded `rma`).

### 3. Meta Ads cron → `meta_ads_daily` → `/meta-ads`, Insights, Client Ads

| Step | Behavior |
|---|---|
| Entrypoint | `GET /api/cron/meta-ads` (hourly) |
| Scope | All **active** `ad_accounts` |
| Transform | `transformMetaInsightsRows` (`src/lib/ingest/meta.ts`) → spend/impressions/clicks + Meta lead/result action counts |
| UI join | Funnel cols match **`leads.utm_content` to `meta_ads_daily.ad_name`** (fragile; drives “Unmatched leads” count) |
| Split | `is_lead_source=true` → org `/meta-ads`; `false` → `/clients-ads` |

### 4. Website analytics cron → `website_daily` → `/website`

| Step | Behavior |
|---|---|
| GA4 | Hourly → sessions/users → `landing_page_visits` / `unique_visitors` (RMA) |
| Wistia | Hourly → plays / watch % / form proxies (RMA) |
| Merge | `mergeAndUpsertWebsiteDaily` with `lead_source=null`, `utm_campaign=null` |
| Upsert conflict | `date,lead_source,utm_campaign` — **Postgres NULLs do not uniquify**, so duplicates accumulate (see QA) |

### 5. Call-logging / lifecycle → `lead_activities` + lead columns → badges / funnel

| Step | Behavior |
|---|---|
| Writes | `src/app/leads/actions.ts` → `lifecycleCadence` / `updateLead` |
| Side effects | Every update stamps `stage`, `lifecycle_status`, `action_status`, `updated_at` |
| Activities | `call_attempt`, `whatsapp_sent`, `reschedule`, `revive`, `note`, `show_outcome`, … |
| Slack | Form notify + minute cron `slack-follow-up` for qualified-unbooked (`slack_no_booking_notified`) |

### Field-shape consistency check

| Area | Status |
|---|---|
| Website ↔ Quickform **custom_fields** qual keys | **Aligned** (canonical long keys + website aliases) |
| UTM aliases | **Still diverge** — Quickform accepts `campaign_name`/`ad_name`/`adset_name`; website only literal `utm_*` |
| Org resolution | Website/booking hard-code `rma`; Quickform multi-org |
| Phone matching | Quickform yes; website email-only |
| Qualified seeding | Different semantics (form bool vs Quickform reject→false only) |
| Extra Quickform keys in `custom_fields` | `Booking details`, `platform`, etc. can land in JSON |

---

## Tables (live code surface)

`leads`, `lead_activities`, `lead_reminders`, `organizations`, `memberships`, `profiles`, `ad_accounts`, `meta_ads_daily`, `website_daily`, `cron_runs`, `table_views`.

---

## QA findings

*(Caught while clicking through — not a full test suite.)*

### Broken / incorrect data

1. **`website_daily` duplicate rows** — RMA `/website` daily table shows many rows for the same date (e.g. 2026-08-24 dozens of times). DB has ~4.2k rows for RMA; conflict target omits `org_id` and uses nullable columns, so upserts do not collapse site-wide rows. Totals may still look plausible while the table is unusable.
2. **Creative ↔ lead matching** — Insights/Meta Ads show **157 unmatched leads** on RMA (name match `utm_content`↔`ad_name`). Large attribution gap.
3. **Phone values with `p:` prefix** — ~188 RMA leads; UI shows `p:+91…` (ingest or sheet artifact).
4. **Trailing “Columnssaving…”** — Column picker sometimes stuck showing “saving…” on Leads/Queue (observed on RMA and Experto).

### Auth / env

5. **Legacy `ADMIN_EMAIL` / `VIEWER_*` env credentials fail** on production Supabase Auth (400 on token). README already marks them legacy; they are still easy to mistake for live logins.
6. Magic-link hash redirect lands on `/login` **without exchanging the session** (no auth callback consumer) — magic links alone do not log you into the app UI.

### UX / consistency

7. **Moksh org** — Meta Ads populated; CRM empty; Website empty. Preview banner correct. Funnel columns on `/meta-ads` all zero while Meta “Leads” metric is non-zero — expected given join to CRM, but easy to misread.
8. **WhatsApp** — Button logs `whatsapp_sent` activity only; copy in UI admits no WhatsApp API.
9. **“Break down by source”** on Website — permanently disabled placeholder.
10. **Member hitting `/clients-ads` or `/admin/organizations`** — soft-redirects to Home (200) rather than an explicit 403 page.
11. **Follow-ups Due tab** — can appear empty if the page is snapshotted before SSR/hydration finishes; after a longer wait it populated correctly (33 rows on RMA).

### Local vs deployed

12. Local `yarn dev` was not reliably reachable from Playwright (EMFILE watch errors). Audit used **production**. Current Pagination code uses serializable `pathname`+`query` (no function props); an older local error about `hrefForPage={function}` should not apply to current source.

### Doc drift

13. **README** still says viewers are limited to meta/website/insights and that `profiles.role` gates access — **false** today (membership + `is_platform_admin`).
14. README omits Quickform ingest, Work Queue, org preview, Client Ads, table views, slack-follow-up cron.
15. **`lead-lifecycle-map-and-user-stories.md` not in repo** — cannot diff live vs that doc; treat this audit as the baseline instead.

---

## Simplification candidates

### Redundant / overlapping

- **Leads list vs Work Queue** — overlapping filters (action status, follow-ups) and dual surfaces for the same CRM actions (detail page vs inline queue). Queue is the operator “do work” surface; Leads is the “find anything” surface — keep both but **collapse duplicated filter chrome** and action implementations onto one shared module.
- **Home funnel vs Insights rate cards** — similar cohort math presented twice with different labels (Booked/Show/Close vs Form-Qualified/Setter-Verified/…).
- **`/meta-ads` vs `/clients-ads/[id]`** — nearly the same Meta table/charts; differ mainly by funnel columns + admin chrome. Strong candidate to **one Meta performance component** parameterized by mode.
- **Invite `profiles.role` vs `is_platform_admin`** — two role concepts; only one gates the product.

### Complexity hotspots (simplify first)

1. **Lead lifecycle state machine** — `stage`, `lifecycle_status`, `action_status`, `qualified*`, booking fields, dead flags, verification fields, post_call, reminders. Multiple parallel representations of “where is this lead.”
2. **Dual ingest pipelines** — website hard-coded RMA vs Quickform multi-org; different match keys and qualified seeding.
3. **Attribution by ad *name*** — drives unmatched counts and Insights complexity; ID-based join would simplify.
4. **Org preview + membership + Client Ads org shells** — many orgs with 0 members exist only as Meta containers.
5. **`website_daily` upsert / null uniqueness** — cron + UI need one row per `(org_id, date)` for site-wide metrics.

### Dead / unused / low-value

- Disabled Website “break down by source.”
- WhatsApp “nudge” without messaging API (activity-only).
- Legacy env auth vars / README viewer gating story.
- `profiles.role` for page access (unused).
- Possibly unused inactive `ad_accounts` rows (e.g. duplicate RMA account with `active=false`).

### Genuinely core (do not rip out)

- **`leads` as system of record** for sales lifecycle + Home funnel counts.
- **Work Queue** as the primary daily operator workflow (tabs + inline log call).
- **Quickform multi-org ingest** (Experto-class clients).
- **Meta sync → `meta_ads_daily`** and platform-admin **Client Ads** monitoring for non-CRM clients (Moksh pattern).
- **Org preview (read-only)** for platform ops.
- **Website/booking ingest for RMA** (even if later generalized).
- **Auth: membership + `is_platform_admin`** (keep; delete the dead role story from docs/UI).

---

## Suggested simplification order (for the next pass)

1. Fix **`website_daily` uniqueness** (include `org_id`; coalesce nulls) and clean duplicates — high user-visible win, low product debate.
2. **Normalize phone / synthetic email** display and ingest (`p:` prefix; document `qf-phone-` pattern).
3. Unify **Meta performance UI** (org lead-source vs client account modes).
4. Collapse **lifecycle field surface** (one status model + derived badges) while keeping Work Queue actions.
5. Revisit **attribution key** (ad id vs name) before investing more in Insights creative tables.
6. Delete or rewrite **README auth/role section** to match live gating; drop unused env auth story from operator docs.

---

## Walk coverage checklist

| Surface | RMA member | Platform admin | Moksh preview | Experto preview |
|---|---|---|---|---|
| Home | ✓ | ✓ | ✓ (0 leads) | ✓ |
| Leads | ✓ | ✓ | ✓ empty | ✓ Quickform |
| Work Queue | ✓ tabs/cards | ✓ | ✓ empty | ✓ read-only |
| Lead detail | ✓ | — | — | — |
| Insights | ✓ | ✓ | ✓ | — |
| Meta Ads | ✓ | ✓ | ✓ spend | ✓ |
| Website | ✓ | ✓ | ✓ empty | — |
| Client Ads + detail | blocked | ✓ | — | — |
| Organizations + detail | blocked | ✓ | — | — |

---

*End of audit. Next simplification work should treat this file as the product baseline unless a newer dated audit supersedes it.*
