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

## 4. Protecting Children and Youth training — overdue follow-ups

Scott's ask, 2026-09-20: anyone overdue for the training becomes a follow-up
assigned to the stake leader who covers them.

**No names in this file.** The overdue people are members; their names live
only in the `magnify_items` rows. Nothing about an individual goes in the repo,
a commit message, or a log. From the report take **name, ward, calling, and
training status/date only** — never a record number, email, birthdate, or
anything else the page shows.

### Where it is

**Reports › Supporting Youth › Protecting Children and Youth Training**
`https://lcr.churchofjesuschrist.org/report/child-protection?lang=eng`
(confirmed from Scott's screen 2026-09-20).

Columns: Name · Position · Sustained · Training Status · Expiration. Training
Status is the one that matters — "Completed" or a red **Past Due**.

Two dropdowns above the table. The first is the **organization** filter, and
its values ARE the routing key, so read the routing table below against it:
All Organizations · Stake Presidency · High Council · Patriarch · Stake Relief
Society · Stake Young Men · Stake Young Women · Stake Primary · Other Callings.
The second narrows by status — set it to Past Due rather than reading every row.

Stake scope shows stake callings; each ward's callings are behind the unit
switch ("My Stake" / "Other Units and Leaders" on the LCR home page).

### Getting the list to the agent

**The egress proxy blocks `lcr.churchofjesuschrist.org` outright** — verified
2026-09-20, not a login problem and not fixable by Scott signing in. A remote
session cannot open this report at all, whatever the state of his browser.

So from a remote session the rows have to be handed over. **A local session
(Claude desktop on Scott's Mac) can drive his Chrome directly** — done
2026-09-27. The unit switch is the dropdown at the top right of the report
(Chicago Illinois Stake, then each ward); it reloads the table, which can take
several seconds — confirm the dropdown shows the ward before reading. The
table is not paginated. Read Name and Position from the Past Due rows only;
"Not Started" is not past due. Screenshots of the filtered table work
fine and are the least effort: set status to Past Due, then capture stake
scope and each ward. Name, position and unit is all that is needed — record
numbers, emails and birthdates stay on the page.

### Routing — who chases whom

One item **per overdue person** (Scott's call, 2026-09-20), owned by:

| Report category | Follow-up owner | How the owner is resolved |
|---|---|---|
| Stake leaders / officers | Stake President's 2nd counselor | `profiles` where `role = 'second_counselor'` |
| Ward Young Women leaders | Stake Young Women President | `owner_label` only — no account |
| Ward Elders Quorum | that ward's high councilor | `hc_member_wards` → `high_council_members` |
| Relief Society leaders | Stake Relief Society President | `owner_label` only — no account |
| Primary leaders | Stake Primary President | `owner_label` only — no account |
| Seminary teachers | high councilor over seminary | `hc_member_stewardships` where `stewardship = 'seminary'` |
| Ward bishopric (bishop and counselors) | **Scott** | `41c69a38-a325-4456-92a8-46b5a68221e2` (Scott, 2026-09-27) |
| Ward Sunday School (presidency, teachers, Builders of Faith) | that ward's high councilor | `hc_member_wards` → `high_council_members` (Scott, 2026-09-27) |
| Aaronic Priesthood quorum advisers and specialists | Stake Young Men presidency | `owner_label` = "Stake Young Men Presidency" — no account (Scott, 2026-09-27) |

Primary includes nursery and Valiant activities leaders. A person with callings
in two categories gets ONE item; the bishopric route wins. Still unrouted: a
ward **daycare leader** — ask Scott; none created on 2026-09-27.

**The three auxiliary presidents have no Magnify account** (the only accounts
are the presidency, 11 high councilors, 3 clerks and the executive secretary).
Scott chose 2026-09-20 to name them in `owner_label` and leave `owner_user_id`
null: the row exists and the presidency and clerks work it, but she does not
see it in the app. Use the office as the label ("Stake Young Women President"),
not a personal name — it survives a release and keeps a name out of the label.

### What the database still cannot answer

Resolved 2026-09-27: Hyde Park 1st and 2nd used to list two high councilors
each. `hc_member_wards` now has exactly one for each, and Scott confirmed that
is who covers both. Every ward resolves to one; if a ward ever returns two,
ask — do not guess, and do not create one item for each.

Resolved 2026-09-20: "over seminary" used to be unanswerable — there was no
portfolio anywhere on `high_council_members`. Migration 035 added
`hc_member_stewardships`, editable at Settings → High Council, and Scott named
the seminary high councilor. Query the table; do not hardcode the person, and
do not ask him again.

One more, worth knowing rather than solving: the Westchester 2nd high
councilor has no Magnify account, so his items need `owner_label` too.

### Item shape

- `kind`: **`pcy`**, always, whoever owns it (037, 2026-09-27). Scott asked
  for these as their own dashboard section, named as LCR names the report, so
  they have their own kind and tile — "Protecting Children and Youth
  Training" — and never land in Assignments. The kind-by-owner trigger only
  rewrites `action`/`assignment`, so it leaves `pcy` alone; set the owner and
  the kind independently. (This replaces the earlier plan of routing them as
  `assignment`/`action`.)
- Visibility needs nothing extra: `magnify_items_select` already lets the
  presidency and clerks see every row, a high councilor see the rows he owns,
  and keeps label-only rows (the auxiliary presidents) with the presidency.
  A high councilor gets the tile only when at least one row is his.
- `title`: `Protecting Children and Youth training overdue — {ward abbr}`
- `detail`: the person and their calling, one line.
- `ward_id`: set from the report's ward.
- `due_on`: Scott's call per pull; leave null if he does not set one.
- `review_state`: `approved` — same as the other LCR-sourced rows (his rule
  from 2026-09-13; the review queue is for meeting extractions).
- `source`: **`lcr_sync`** — the check constraint allows only manual /
  meeting / lcr_sync / email; plain `lcr` fails. `source_ref`:
  `{"lcr":"protecting_children_youth","ward":"<abbr>|STAKE","person":"<Last, First as LCR prints it>","pulled":"<date>"}`.
  Stake-level rows have `ward_id` null, `ward` = `STAKE`, and the title ends
  "— Stake". `detail` is "First Last — Calling; Calling".

### Re-running

`source_ref->>'person'` plus `->>'lcr'` is the dedupe key: on a later pull,
skip anyone who already has an open item, and mark done the items for anyone
no longer on the overdue list. Do not delete them — completing them is the
record that the follow-up worked.

## What the home page also shows (for Phase 3 metrics, not yet used)

The LCR home card set carries live stake numbers: Endowed with Recommend
(e.g. 533 / 1113), Sacrament Meeting Attendance by month, Ministering
Interviews current quarter (brothers / sisters), Members Moved In, New Members,
People Being Taught. This is the natural source for `magnify_metrics` when
Phase 3 (LCR metrics sync) is built.
