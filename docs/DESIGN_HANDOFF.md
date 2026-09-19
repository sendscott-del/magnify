# Design handoff — Sunday schedule and LCR queues on the dashboard

Date: 2026-09-19. Status: plan agreed, awaiting Claude Design artboards. No code until artboards are back.

Lane: Church. No member names in this doc, in fixtures, or in artboards. Use placeholder names.

## Why

The stake president runs a weekly executive-secretary routine through a chat agent: meeting schedule sync from a Google Sheet to a calendar, Sunday building assignments with drive times and conflicts, the Saturday reminder text, Sunday-night Slack reminders, President's Review of expenses, monthly statement status, training compliance, CES endorsements. The output arrives as a chat report. That interface is too hard to use. Everything the app can hold moves onto the Magnify dashboard, which is already the app's home (v2.51.0+) and already holds interviews, directives, assignments, and the LCR-pulled recommend and audit queues.

Two releases:

1. **Sunday schedule** (the app becomes the source of truth for the leadership meeting schedule; the Google Sheet retires).
2. **LCR queues** (four tiles fed by the existing on-demand pull from the president's signed-in Chrome; see `docs/LCR_PULL.md`).

Plus a small **Requests** tile that ships with release 2.

## What exists today (design must fit it)

- Dashboard = zone of `StatTile`s (`components/dashboard/cards.tsx`: value, unit, label, sub-line, optional red flag, tap drills to a list) then workstream cards. Every tile answers how many, by when, whose. A tile without a sub-line should not exist.
- Presidency sees Mine / Everyone; high councilors and clerks see their own view only.
- Item detail opens as a bottom sheet (`ItemSheet`, `InterviewSheet`). New surfaces should reuse the sheet pattern, not push full screens, except for the schedule editor.
- Desktop web is full width. Phone-first, but the presidency uses it on laptops on Sunday morning.
- Spanish is a first-class language (`constants/translations`). Every new string has an `es` key.

## Release 1 — Sunday schedule

### Data (new tables, `magnify_` prefix, stake-scoped RLS)

**`magnify_schedule_weeks`** — one row per Sunday.

| field | meaning |
|---|---|
| sunday_on (date) | the Sunday |
| kind | `meetings`, `holiday`, `stake_conference`, `general_conference`, `ward_conference`, `none` |
| holiday_label | shown when kind is holiday (e.g. "Mothers' Day") |
| p_wards / c1_wards / c2_wards (uuid[]) | building assignments: president, 1st counselor, 2nd counselor; each is a list of wards, usually one building |
| notes | free text, presidency-only |

**`magnify_schedule_meetings`** — zero or more per week.

| field | meaning |
|---|---|
| week_id | FK |
| body | `SP`, `SP_RS`, `HC`, `SC`, `BC`, `HC_1on1`, `ADULT_LEADERSHIP`, `TRAINING`, `WARD_CONFERENCE` |
| starts_at / ends_at (time) | end defaults 30 min for SP, 60 for everything else |
| format | `in_person` (default), `zoom` |
| label | optional free text ("view Sacred Funds video", "moved from Sep 28") |

**`magnify_buildings`** and **`magnify_ward_meeting_times`** — the five buildings with address, and each ward's sacrament start time. The presidency edits these rarely; LCR Unit Settings is the authority. **`magnify_travel_minutes`** — the 5×5 matrix.

**`magnify_hc_rotation`** — one row per Sunday: which high councilor accompanies the president (FK to `high_council_members`), and a one-line reason. No capacity notes, no personal circumstances in the database; those stay out of the app entirely.

**`magnify_reminders_sent`** — log of every reminder the app posted or texted: week, body, channel (`slack`, `tidings`), sent_at, sent_by. This is the double-send guard and the audit trail.

### Screens

**A. "This Sunday" card** — top of the dashboard on Friday through Sunday, above the tiles. Shows the president's day as a timeline:

```
Sunday, Sep 20
7:30  Stake Council · stake offices · in person
8:30  SP + RS · stake offices
9:30  Drive to Blue Island · 25 min
10:00 Blue Island sacrament
      ⚠ Moraine Valley also at 10:00 — pick one
11:00 HP1 bishopric training · Hyde Park · 28 min from Blue Island, leave by 10:30
Companion: [HC member] · "his own ward is Blue Island"
[Post Slack reminders]   [Send text reminder]   (presidency only; each button shows sent-state after use)
```

Rules for the timeline:
- Morning meetings are at the stake center unless format is zoom.
- One sacrament meeting per ward in the P column, using the ward's start time and a 70-minute duration.
- A drive block between any two consecutive events in different buildings, using the matrix.
- Conflict when two events overlap or the gap is shorter than the drive. Conflicts are stated in words with the recommended fix ("move the 11:00 to 11:30" or "pick one of the two 10:00 meetings"). Never silently reorder.
- Personal calendar events (the president's own Google Calendar) are NOT read. The card is built from app data only. Out of scope: two-way calendar sync.
- Counselors see their own day (their column), not the president's.

**B. Schedule screen** (Settings → Meeting schedule, presidency + clerks only). The year as a list of Sundays, quarter by quarter. Tap a Sunday to edit: kind, meetings (add/remove rows: body, time, format), P/1C/2C ward pickers, companion. Same edit form is reachable from the This Sunday card. The design should make the common edit (change one Sunday's P column on a Saturday night from a phone) a two-tap job.

Import: a one-time script loads the 2026 rows from the Google Sheet. Not a UI feature.

**C. Reminder actions**

- *Post Slack reminders* posts the week's reminders to the right channels through the existing webhook rows (`#stake-presidency`, `#high-council`, `#stake-council`) in the established wording ("<!channel> High Council meeting will be held this Sunday (M/D) from H:MM–H:MM IN PERSON at the stake offices. Please respond here if you are unable to make it."). Shows a confirmation with the exact text before posting. Logs to `magnify_reminders_sent`.
- *Send text reminder* inserts the Tidings row (same body as today's segment G, including the signature line) for the HC and/or SC list for that Sunday. Only shown when the week has HC or SC. Refuses a second send for the same week and list. Shows recipient count and the exact body before sending.
- A scheduled edge function can send the Saturday text automatically once the button has been trusted; that toggle is a later setting, not in this release.

Zoom links: the two standing links live in a stake settings row, not hardcoded; the Slack post includes the link when the format is zoom.

### Tiles touched

None removed. The This Sunday card is a new zone above the tiles, visible Friday–Sunday (and any day when there is an unresolved conflict for the coming Sunday).

## Release 2 — LCR queues and Requests

### Data

`magnify_items` gains kinds: `expense_review`, `training`, `endorsement`, `request`. Statement status is one row in a new small table `magnify_lcr_status` (statement_month, reviewed_by_label, reviewed_on, pulled_at). All rows carry `source='lcr_sync'` and a `pulled_at` so the tile can say "as of Sat 9:40 AM".

Confidentiality: for expenses store ref#, payee, purpose, amount, and whether a matching written approval was found. For training store the leader's name and calling and unit only. For endorsements store name and type (student/employee). Nothing else from those pages.

### Tiles (presidency only)

| Tile | value / unit | sub-line | flag | drill |
|---|---|---|---|---|
| President's Review | 3 expenses | "2 matched · 1 no approval found" | red when any unmatched or HQ auto-post | list; each row opens a sheet with ref#, payee, purpose, amount, match note, "Open in LCR" link |
| Statement | Aug 2026 | "reviewed by clerk Sep 8 · ready for you" or "not yet reviewed by clerk" | red after the 15th if the clerk has not reviewed | opens LCR statement page |
| Training | 4 leaders | "2 clergy cert · 2 PCY past due" | red when any bishop lacks the clergy cert | list grouped by unit; row → member sheet with calling, unit, which training, "Draft email" opens a mailto with the standard text |
| Endorsements | 4 pending | "4 student · 0 employee" | neutral | list; row opens the endorsements site |
| Requests | 2 open | "1 temple recommend · 1 calling interview" | red when older than 3 days | list; row → sheet with who (label), what, proposed slots, channel, "Mark scheduled" (which creates the interview row where applicable) |

Every LCR tile shows its `pulled_at` and a "Refresh" affordance that explains the pull is done from the president's signed-in Chrome (it cannot run from the app). The tiles are empty-state calm when nothing is pending.

## Out of scope

- Reading Gmail, iMessage, or Slack from the app.
- Two-way Google Calendar sync. (The presidency calendar sync can stay as an agent output if wanted; the app does not depend on it.)
- Zoom summary ingestion (blocked on Zoom auth).
- Any automation that sends without a person tapping, in this release.

## Success

The Saturday and Sunday chat reports stop existing. The president opens Magnify on Saturday night, sees his Sunday, fixes the P column if needed, sends the text and the Slack posts with two taps, and on Friday sees the LCR queues with a link to each.
