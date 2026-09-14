# LCR → Dashboard pull (on demand, through Scott's Chrome)

Scott's decision 2026-09-13: LCR data reaches the dashboard by reading the LCR
pages in **his signed-in Chrome**, **on demand**, never on a schedule and never
with stored credentials. There is no LCR API. This is the procedure.

Lane: Church. Everything on these pages is confidential. Store the minimum
named below and nothing else. **Membership record numbers, emails, and any
financial figure never leave the page.**

## Before starting

- Scott must be signed in to LCR in Chrome. Church SSO re-prompts for a
  password per session; that prompt is his to complete, not the agent's.
- Open `https://lcr.churchofjesuschrist.org/` in a claude-in-chrome tab and
  confirm the home page shows his name and "Stake President".

## 1. Temple › Recommend Activations

URL: `https://lcr.churchofjesuschrist.org/temple/recommend/recommend-activations?lang=eng`

Two tables. **Use only the first** ("Awaiting Stake Activation"). The second
("Recently Activated") is history.

```js
// Awaiting Stake Activation only. Name cell's 2nd line is the record number — drop it.
const tb=[...document.querySelectorAll('table')][0];
[...tb.querySelectorAll('tbody tr')].map(tr=>{const c=[...tr.querySelectorAll('td')].map(t=>t.innerText.trim());
  return {name:c[0].split('\n')[0].trim(), unit:c[1].trim(), month:c[3]};});
```

Item shape → `magnify_items`:

| field | value |
|---|---|
| kind | `recommend` |
| title | `Activate recommend — First Last` (from "Last, First") |
| detail | `{ward abbr} · issued {Mon YYYY}` |
| due_on | first day of the month AFTER month issued (so they sort oldest-first and "overdue" means overdue) |
| ward_id | from `wards.abbreviation` |
| owner_user_id | by ward — see map |
| source / source_ref | `lcr_sync` / `{"lcr":"recommend_activation","name","unit","month_issued","pulled":"YYYY-MM-DD"}` |
| review_state | `approved` (Scott: LCR facts with his own owner rule need no queue) |

**Ward → owner map (Scott, 2026-09-13):**

| Wards | Owner |
|---|---|
| HP1, HP2, HP3, MW, CH2 | Celso Alvarez `ba0f7d18-8862-4e3e-b08b-399883d38cf2` |
| BI, MV, WC1, WC2 | Spencer (Walter) Vielman `b512085c-8cab-4ed8-9586-b09a4826f85f` |

LCR unit names → abbreviations: "Midway Ward (Spanish)"→MW, "Blue Island
Ward (Spanish)"→BI, "Chicago 2nd Ward (Spanish)"→CH2, "Hyde Park 3rd Ward
(Spanish)"→HP3, "Westchester 2nd Ward (Spanish)"→WC2, others by name.

**Re-run rule:** match existing rows on `kind='recommend'` +
`source_ref->>'lcr'='recommend_activation'` + `source_ref->>'name'` +
`source_ref->>'unit'`. New → insert. Present already → leave alone (the owner
may have reassigned it). Gone from LCR → set `status='done'`,
`completed_at=now()` (it was activated).

## 2. Temple › Members Preparing for Temple Ordinances › Ready for Stake Interview

URL: `https://lcr.churchofjesuschrist.org/temple/ordinance-preparation/members-preparing?lang=eng`

Four collapsible sections; expand **"Ready for Stake Interview (N)"** only.
Columns: Name · Ordinance · Temple Appointment · Unit.

| field | value |
|---|---|
| kind | `recommend` |
| title | `Stake interview — First Last ({ordinance, lower case})` |
| detail | `{ward abbr} · ready for stake interview` |
| owner_user_id | **Scott** `41c69a38-a325-4456-92a8-46b5a68221e2` (he reassigns to Spencer/Celso himself when the member is English-speaking) |
| source_ref | `{"lcr":"ready_for_stake_interview","name","unit","ordinance","pulled"}` |
| review_state | `approved` |

Same re-run rule keyed on `ready_for_stake_interview` + name + unit.

## 3. Finance › Local Unit Financial Audit System › Audit Progress

Opens a separate app: `https://audit.churchofjesuschrist.org/` → **Audit
Progress** tab → **Current Audit Period**. It carries a "Confidential — do not
capture… except in connection with local unit audits" notice; Scott accepted
storing **ward + stage only** as being that use. No figures, no exception
details, no committee roster (that table has personal emails — skip it).

Grid: one row per unit, six stage icons (Select Transactions · Conduct Audit ·
Auditor Review · Unit Leader Review · Audit Committee Review · Stake or
District President Review). Status is the small badge on each icon: green
check = Completed, arrow = In Progress / Not Started, circle-slash = N/A. The
DOM does not expose the status as text — read it visually (zoom on the icon
column) or from the icon's SVG.

**Rules (Scott, 2026-09-13)** — create a `kind='audit'` item when the named
stage is the current, not-yet-completed one:

| Unit | Stage awaiting | Owner |
|---|---|---|
| Chicago Illinois Stake | Unit Leader Review | Scott |
| any ward | Audit Committee Review | Celso |
| any ward | Stake or District President Review | one item each: Celso **and** Scott |

`title`: `Audit — {ward abbr}: {stage}`; `detail`: `{stage} · current period`;
`ward_id` set; `source_ref` `{"lcr":"audit_progress","unit","stage","pulled"}`.
When the stage completes on a later pull, mark the item done.

State on 2026-09-13: every unit completed all six stages for the current
period — **no audit items created**. The rules are recorded here for the
next period.

## What the home page also shows (for Phase 3 metrics, not yet used)

The LCR home card set carries live stake numbers: Endowed with Recommend
(e.g. 533 / 1113), Sacrament Meeting Attendance by month, Ministering
Interviews current quarter (brothers / sisters), Members Moved In, New Members,
People Being Taught. This is the natural source for `magnify_metrics` when
Phase 3 (LCR metrics sync) is built.
