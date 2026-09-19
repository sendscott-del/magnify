# Handoff: Sunday schedule + LCR queues on the Magnify dashboard

Target repo: `sendscott-del/magnify` (branch `main`). Commit this folder to
`docs/design_handoff_sunday_schedule/`.

## Overview

Implements the two releases in `docs/DESIGN_HANDOFF.md`: (1) the app becomes the
source of truth for the leadership meeting schedule and grows a **This Sunday**
card, and (2) four **LCR queue** tiles plus a **Requests** tile. The artboards in
this bundle are the agreed visual spec for both, across all four dashboard
layouts.

## About the design files

`Magnify Dashboard Artboards.dc.html` is a **design reference built in HTML** — a
prototype of intended look and content, not production code. Recreate it in this
repo's real environment: React Native / Expo, `StyleSheet.create`, tokens from
`constants/theme.ts`, the existing dashboard parts in `components/dashboard/`.
Do not port the HTML, and do not introduce new styling primitives.

Fidelity: **high**. Colors, sizes, radii, and copy are final. Every value in the
artboards already comes from `constants/theme.ts` / `lib/dashboard.ts`, so in
code they should be token references, never literals.

## Reuse, do not rebuild

| Need | Use |
|---|---|
| Tiles | `StatTile` + `TileSpec` in `components/dashboard/cards.tsx` |
| Glyph chip, flag pill, section header, segmented, calm empty, callout | `components/dashboard/primitives.tsx` |
| Tile grid | `components/dashboard/Grid.tsx` (`minColumnWidth`, `minColumns={2}`) |
| Item detail | `ItemSheet` / `InterviewSheet` (bottom sheet, not a pushed screen) |
| Buttons | `components/ui/Button.tsx` — `primary` / `outline` / `secondary` / `ghost` |
| Screen chrome | `components/ui/ScreenHeader.tsx` |
| Kind color + glyph | `KIND` in `lib/dashboard.ts` — one color and one Ionicon per kind, no inline hexes |
| Strings | `constants/translations.ts`, EN **and** ES for every new key |

## New KIND entries (decide before building)

Release 2 adds kinds `expense_review`, `training`, `endorsement`, `request` to
`magnify_items`, and the statement tile. The artboards use these pairings; add
them to `KIND` so no call site inlines a glyph:

| Kind | Color | Ionicon |
|---|---|---|
| `expense_review` | `#F97316` (audit orange) | `receipt-outline` |
| statement (from `magnify_lcr_status`) | `#F97316` | `document-text-outline` |
| `training` | `#2563EB` (standard blue) | `school-outline` |
| `endorsement` | `#14B8A6` (recommend teal) | `ribbon-outline` |
| `request` | `#3B82F6` (action blue) | `hand-left-outline` |

## Screens

### A. This Sunday card — new zone above the tiles

Visible Friday–Sunday, and any day the coming Sunday has an unresolved conflict.

Container: white, `Radius.md` (10), 1px `gray.200`, `Shadow`, plus a **3px top
border in `#14B8A6`**, padding 14, column gap 12.

- Eyebrow: 11px / 600 / `+0.6px` letter-spacing, `#14B8A6`, uppercase — `THIS SUNDAY`,
  `THIS SUNDAY · YOUR DAY` (counselor), `THIS SUNDAY · MEETINGS` (clerk).
- Date: 20px / 700 / `gray.900` — `Sunday, Sep 20`.
- Conflict flag, top-right: `FlagPill` tone `late`, label `1 CONFLICT`.
- Timeline rows: 48px time gutter (13px / 800 / `gray.700`) + title (15px / 700 /
  `gray.900`) + meta (11px / `gray.500`).
- Drive blocks: `gray.50` fill, **1px dashed `gray.200`**, radius 10, padding 8×10,
  38px centered `car-outline` 18px `gray.400`, text 11px / 600 / `gray.500` —
  `Drive to Blue Island · 25 min · leave by 9:35`.
- Conflict callout: `#FEE2E2` fill, 1px `error` border, radius 10, padding 10,
  `alert-circle-outline` 18px `error`, text 12px / 17px line-height `#7F1D1D`.
  **State the fix in words** ("pick one", "move the 11:00 to 11:30"). Never reorder
  the day automatically.
- Companion row: 1px `gray.100` top rule, 26px `assignment`-purple glyph chip
  (`people-outline`), text 12px `gray.600`.
- Actions: `Post Slack Reminders` (primary, full width), then `Send Text Reminder`
  (outline) and `Edit Sunday` (secondary) side by side. Min height 44.
  After sending: `gray.100` fill, opacity 0.5, `pointer-events: none`,
  `checkmark` glyph, `Slack posted 9:08 AM` / `Text sent to 21 · 9:12 AM`.
  Disabled, never hidden.

Timeline construction rules (from the handoff, unchanged): morning meetings at the
stake center unless `format = zoom`; one sacrament per ward in the viewer's column
at the ward's start time, 70 minutes; a drive block between consecutive events in
different buildings from `magnify_travel_minutes`; conflict when events overlap or
the gap is shorter than the drive. App data only — no personal calendar reads.

### B. Schedule editor — Settings → Meeting schedule (presidency + clerks)

Year as a list of Sundays, quarter by quarter; tapping a Sunday opens the edit
form, which is also reachable from the This Sunday card. Order on the edit screen,
top to bottom, because the Saturday-night edit must be two taps:

1. **Kind of Sunday** — wrapping pills, min height 44, selected = `brand-primary-fade`
   fill + 1.5px `primary` border + `primary` 13px/600 text; unselected = white +
   1.5px `gray.200` + `gray.500`.
2. **Building assignments** — first thing on the screen. White list card, rows min
   height 48, 34px `P` / `1C` / `2C` gutter (11px / 800 / `primary`), ward name
   15px / 700, meta 11px `gray.500`, `chevron-forward` 20px `gray.400`. A conflicting
   row's meta turns `error` 11px/600.
3. **Meetings** — one row per meeting: name + `7:30–8:30 · in person`, a full-round
   `gray.100` body chip (`SC`, `SP_RS`, `HC`…), and `close-circle-outline` 22px to
   remove. Last row is `add-circle-outline` + `Add a meeting` in `primary`.
4. **Companion** — single 1.5px-bordered field, 48px min height, chevron.
5. `Save Sunday` — primary, min height 48, 17px label.

Notes (`magnify_schedule_weeks.notes`) sit below Save, presidency-only.

### C. Reminder confirmations

Both are `SafeModal` sheets, radius `Radius.lg` (16), `0 8px 24px rgba(0,0,0,0.12)`,
padding 16, gap 16.

- **Slack**: one `gray.50` / 1px `gray.200` / radius-10 block per channel, channel
  name 11px / 800 uppercase `gray.600`, body 13px / 19px `gray.900`, verbatim
  wording including `<!channel>` and the in-person/Zoom clause. A `warning` callout
  states that a second post for the same week is refused. CTA `Post Both Reminders`.
- **Text**: count first — 30px / 800 `21` + 11px / 600 `unique recipients` — then the
  exact body including the signature line, then `Send to 21 Recipients`.

Both write a `magnify_reminders_sent` row (week, body, channel, sent_at, sent_by),
which is also the double-send guard. Zoom links come from the stake settings row,
not the message template.

### D. Role layouts (four)

| Artboard | Role | Shape |
|---|---|---|
| 1a | Stake President | This Sunday (own day, conflicts, both reminder buttons) · Mine / Everyone · tiles · From LCR zone with `AS OF SAT 9:40 AM` note and a Refresh tile |
| 1b | Counselor | This Sunday (own day) · **Mine / High council** · tiles · no LCR zone |
| 1c | Clerk / Exec Sec | This Sunday **meetings only** — no presidency itinerary — plus reminder buttons and a sent-state line · Mine / Everyone · stake-wide tiles |
| 1d | High Councilor / Stake Council | Your Sunday card (companion note, own interview date) · no switch, no LCR, no reminder buttons · own assignments + workstreams |

Surfaces a role cannot access are **absent** — no locked card, no "not shown"
placeholder, nothing that reveals the surface exists.

### E. Access model — revised, supersedes the table in `docs/DESIGN_HANDOFF.md`

SP = stake president · C = counselor · Clk = clerk + executive secretary ·
HC = high councilor · SC = stake council (new role). Enforce in RLS, not the client.

| Surface | SP | C | Clk | HC | SC |
|---|---|---|---|---|---|
| This Sunday card | own day | own day | meetings only | companion | own day |
| Reminder buttons | yes | yes | yes | — | — |
| Building assignments | all | all | all | — | — |
| President's Review | yes | — | — | — | — |
| Statement · Endorsements | yes | — | all | — | — |
| Training compliance | yes | yes | all | own PCY | own PCY |
| Assignments (any meeting) | all | all | all | own | own |
| Requests | all | own | all | — | — |
| Interviews | all | own | — | date only | — |

Changes from the original table, all agreed in review:

- The clerk does **not** see the president's Sunday itinerary, the President's
  Review, or the interview queue. He keeps the meeting list, the reminder buttons,
  the statement, audits, and requests.
- `SP assignments` and `HC assignments` collapse into **one Assignments tile**.
  Items can come from stake presidency, adult leadership, stake council, or high
  council meetings, so the tile is source-agnostic: label `Assignments`, sub-line
  `2 due this week · from SP, council, HC meetings`. Scope by owner, not by meeting.
- HC and SC see their **own** Protecting Children and Youth training status.
- A stake council member has no interview row at all.

## Tiles (release 2, presidency unless noted)

| Tile | value / unit | sub-line | flag | drill |
|---|---|---|---|---|
| President's Review | `3` / `expenses` | `2 matched · 1 no approval found` | red `1 UNMATCHED` | list → sheet: ref#, payee, purpose, amount, match note, `Open in LCR` |
| Statement | `Aug 2026` (24px) | `reviewed by clerk Sep 8 · ready for you` / `not yet reviewed by clerk` | red `PAST 15TH` after the 15th if unreviewed | LCR statement page |
| Training | `4` / `leaders` | `2 clergy cert · 2 PCY past due` | red `BISHOP` when a bishop lacks the clergy cert | list grouped by unit → member sheet, `Draft email` mailto |
| Endorsements | `4` / `pending` | `4 student · 0 employee` | neutral `LCR` | endorsements site |
| Requests | `2` / `open` | `1 temple recommend · 1 calling interview` | red when older than 3 days | list → sheet with proposed slots, `Mark scheduled` |

Every LCR tile shows its `pulled_at` (`AS OF SAT 9:40 AM` as the section note) and a
Refresh affordance that says the pull runs from the president's signed-in Chrome.
Empty states are calm (`CalmEmpty`), not error-shaped.

## Data

Exactly as specified in `docs/DESIGN_HANDOFF.md` — `magnify_schedule_weeks`,
`magnify_schedule_meetings`, `magnify_buildings`, `magnify_ward_meeting_times`,
`magnify_travel_minutes`, `magnify_hc_rotation`, `magnify_reminders_sent`,
`magnify_lcr_status`, and the four new `magnify_items` kinds. All stake-scoped RLS.
No member names, capacity notes, or personal circumstances in any of these tables.

## Design tokens (all already in `constants/theme.ts`)

Colors `primary #1B3A6B`, `primaryLight #2A5298`, `primaryFade #E8EEF8`,
`accent #C9A84C`, gray 50–900, `success #10B981`, `warning #F59E0B`,
`error #EF4444`, `info #3B82F6`; stage and type palettes.
Spacing 4 / 8 / 16 / 24 / 32 / 48. Radius 6 / 10 / 16 / 24 / 9999.
FontSize 11 / 13 / 15 / 17 / 20 / 24 / 30; weights 400 / 600 / 700 / 800.
Shadow `0 2px 8px rgba(0,0,0,0.08)`; sheets `0 8px 24px rgba(0,0,0,0.12)`.
Tile geometry: padding 12×14, gap 6, min height 118, number 30px/800/`-1px`,
unit 11px/600 `gray.500`, label 13px/600 `gray.700`, sub 11px `gray.500` pinned to
the bottom. Glyph chip 26×26, radius 7, kind color at `+'22'` alpha.

## Copy rules

Title Case for buttons and titles, sentence case for sub-lines and helper text, no
emoji, no exclamation marks outside completion confirmations. Always counts with
units (`21 unique recipients`, `3 of 9`). Plain procedural verbs. Every string gets
an `es` key; allow ~30% more width — Spanish is not yet shown in the artboards and
the timeline gutters are the tightest spot.

## Assets

Ionicons only, names as used in the artboards and `KIND`. In the app they come from
`@expo/vector-icons`; the bundled `src/svg/` copies exist purely so the HTML
reference renders offline — do not add them to the app.

## Files in this bundle

- `Magnify Dashboard Artboards.dc.html` — artboards 1a–1g (open in a browser)
- `src/svg/*.svg` — Ionicons used by the reference file

## Build order

1. Tables + RLS, and the one-time 2026 schedule import script.
2. `KIND` entries and translation keys (EN + ES).
3. This Sunday card with the timeline/drive/conflict builder, president first.
4. Schedule editor, then the reminder sheets and `magnify_reminders_sent`.
5. Role gating for all four layouts; verify each role against the table above.
6. Release 2 tiles, each with `pulled_at` and drill-down.
