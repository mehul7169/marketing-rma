# Pre-Call Lead Lifecycle — Spec v2 (setter side, ends at Showed Up)

Supersedes v1. Post-call / after-sales (closed, lost, post_call_status, follow-up calls, contract) is a separate tab and separate spec, handed off at Showed Up.

## 1. Decisions locked in (from your answers)

| Topic                                    | Decision                                                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `setter_verified*`                       | Dropped. Website leads arrive Call Booked + not yet qualified; the setter's job is to qualify them.            |
| Qualification                            | Two separate things: **Qualified** (setter-decided, pipeline) and **Form Qualified** (tag only, not pipeline). |
| KPI                                      | **Call Booked** is the headline. "Qualified Call Booked" retires as a stage/KPI (still derivable as a filter). |
| Reschedule                               | Stays Call Booked; logged as an event (`reschedule`, already in `lead_activities`).                            |
| Cancel                                   | Booking cleared, lead is no longer Call Booked; logged as an event.                                            |
| No-show                                  | Ends the journey (treated as dead, reason `no_show`). Revivable.                                               |
| Revive                                   | One action, available on any Dead / Unqualified / No-show lead.                                                |
| Lost                                     | = Dead. No "closed-lost" concept.                                                                              |
| Contacted                                | Any call attempt, including no-answer.                                                                         |
| Dead reason                              | Optional, good-to-have.                                                                                        |
| Overrides                                | None. Nobody can override hard blocks for now.                                                                 |
| Backfill                                 | None for contradictory leads, except the Form Qualified split (section 6).                                     |
| Form Qualified                           | Separate yes/no column `form_qualified`. Tag only.                                                             |
| Setter marks Unqualified                 | Lead automatically becomes Dead, reason `not_qualified`. Revivable. Going forward only.                        |
| Showed Up detection                      | Manual toggle only for now.                                                                                    |
| Follow-up needed, no booking             | Stage = Contacted, plus a follow-up date.                                                                      |
| After Showed Up                          | Lead stays in the setter table for now.                                                                        |
| `is_dead` vs `stage` mismatch (34 leads) | Leave as is. Derived Dead reads `is_dead`.                                                                     |

## 2. Vocabulary: one list of words, nothing else

**Stage (the only status word a user sees):** New → Contacted → Qualified → Call Booked → Showed Up

**Terminal tag (replaces Dead / Unqualified / No-show / lifecycle_status):** Dead, with optional reason (`not_qualified`, `no_show`, `no_response`, `not_interested`, other). Revive clears it.

**Not statuses anymore — plain columns shown as badges:**

- **Follow-up** = a date (`next_action_at`). The UI shows it as a coloured date: grey future, amber today, red past. No words like "Follow-up Due / Overdue" exist anywhere, so the vocabulary shrinks from your 4 action-state words to 0.
- **Needs qualification** = Call Booked is set and Qualified is empty (the website-lead case). A badge, not a stage.
- **Form Qualified** = tag chip.

"Untouched" becomes simply **New**. "Personally Contacted" becomes **Contacted**.

## 3. Milestones (stored) and how Stage is derived

| Milestone   | Stored as                                                 | Set by                                                  |
| ----------- | --------------------------------------------------------- | ------------------------------------------------------- |
| Contacted   | `contact_attempts > 0` (or first `call_attempt` activity) | Logging any call attempt                                |
| Qualified   | `qualified = true` (+ `qualified_at`)                     | Setter marks Qualified                                  |
| Call Booked | `call_booked_at`                                          | Booking (website / cal.com) or setter logging a booking |
| Showed Up   | `call_showed_at`                                          | Manual toggle now, auto-detection later                 |
| Dead        | `is_dead` + `dead_reason`                                 | Setter / system (no-show)                               |

Stage = first match, top to bottom: Dead tag overlays, otherwise Showed Up → Call Booked → Qualified → Contacted → New.

Important data finding: `qualified_at` is set whenever qualification is _decided_, including `qualified=false` (507 of the 688 rows with a `qualified_at` are `qualified=false`). So the Qualified milestone must key off `qualified = true`, never off `qualified_at IS NOT NULL`. Real count today: about 200 leads with `qualified=true`. My v1 spec and the earlier "688" figure were wrong on this.

## 4. Guardrails (no overrides)

**Hard blocks**
| Action | Rule |
|---|---|
| Mark Showed Up | Requires `call_booked_at` |
| Mark Call Booked via setter action | Requires at least one logged call attempt (or the booking came from the website/cal.com) |
| Edit name / phone / email / form-fed fields | Not editable |
| Org-preview mode | Read-only |

**Soft warnings (confirm to proceed)**
| Action | Warning |
|---|---|
| Mark Dead on a lead with a booked/showed call | "This lead had a booked call. Mark dead?" |
| Clear a milestone (e.g. cancel booking) | Short reason prompt, logged |

**Always allowed, always logged:** every edit writes a `lead_activities` row attributed to the user. Editing a milestone sets or clears its timestamp automatically.

**Flagged, not blocked (Data Quality view):** Qualified without any call activity, Call Booked and Qualified=false, etc.

## 5. Performance: computed vs stored

Measured on the live database: deriving Stage for all 1,971 leads with the full CASE expression took **1.5 ms** (sequential scan, no index). Even at 100x the data it stays well under a second, so the computation itself is not a lag risk. What actually makes things slow is fetching 62 columns and related tables per page, and recomputing in JavaScript per row on every render.

Recommendation, in order of preference:

1. **Stored generated column** `stage` in Postgres, computed from the milestone columns by the database itself. It is always in sync (zero drift or "flaky" behaviour, because nobody writes it), indexable, and filters/sorts as fast as any normal column. Cohort filters and Meta/Slack numbers then just read it.
2. A plain SQL view is the fallback; fine at your size, slightly slower to filter at scale.
3. Do not derive in the React render loop.

Two things must stay out of the stored column because they depend on "now": Follow-up colour (amber/red) and "Needs qualification" is fine to store but the date colouring is computed in the UI from `next_action_at` (a single comparison, negligible cost).

## 6. Form Qualified backfill (approved), see `sql-form-qualified-backfill.sql`

Which rows hold a form answer vs a setter decision, from live data:

- `qualified_by = 'form'`: 480 leads. These are form answers. 102 of them also have a later setter decision in `lead_activities` (a `call_attempt` qualified/not_qualified or a verification).
- `qualified_by IS NULL`: 221 leads, all but 3 from quickform (which has no qualification questions). 179 have setter evidence. Treated as setter decisions, unchanged.
- `qualified_by = <email>`: 30 leads. Setter decisions, unchanged.

Backfill for the 480 form rows: copy the answer into `form_qualified`, then set `qualified` from the latest setter evidence (102 leads) or NULL if none (378 leads).

Consequence: 347 live leads (261 form-unqualified + 86 form-qualified) end up with no setter decision. 263 of the form-unqualified ones currently sit in `lifecycle_status='unqualified'`, which likely keeps them out of the queue today. After the split they become "not yet qualified by a setter". See open question 1.

The backfill must ship together with the code change (ingestion writes the form answer to `form_qualified`; the Meta Ads "qualified opt-ins" metric reads `form_qualified`). Otherwise new leads keep writing the form answer into `qualified`.

## 6b. Earlier findings (kept for reference)

1. **`qualified` currently means Form Qualified for most leads.** 159+90+66+40+52+... rows have `qualified_by='form'`, and most quickform leads have `qualified_by=NULL`. So the existing `qualified` column is mostly the form's answer, not the setter's. To make Qualified setter-only, form values must move to a new `form_qualified` column and `qualified` resets for those leads. That drops today's "Qualified" count from about 200 to roughly the few dozen setter-decided leads. This is the one place a one-time migration is unavoidable even with no general backfill.
2. **`is_dead` (335) ≠ `stage='dead'` (301).** 34 leads are dead by one field but not the other. After derivation, Dead = `is_dead`, so 34 leads change appearance.
3. `call_cancelled_at` was already slated to be dropped; with cancel = clear `call_booked_at` + log an event, it stays dropped.

## 7. Open questions (remaining)

1. The 261 live form-unqualified leads: after the split, should setters work them like any other lead, or should Form Qualified = No keep them out of the Work Queue by default (filterable)? My suggestion: keep them out by default, so the queue doesn't suddenly grow by 261.
