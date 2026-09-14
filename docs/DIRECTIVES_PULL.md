# Area directives → Dashboard pull (on demand)

Scott's decision 2026-09-13: directives from area leadership reach the
dashboard by reading **sendscott@gmail.com** (Gmail MCP) and **iMessage on
this Mac**, on demand. Every item lands as `kind='directive'`,
`review_state='pending_review'` — Scott approves, edits, or discards in the
review queue before anyone else sees it.

Lane: Church. Store the ask, the owner, the date, and a pointer to the
thread. Nothing pastoral, no attachments, no member lists.

## Who counts as area leadership (confirmed from the mail itself)

| Sender | Role | Treat as |
|---|---|---|
| Andrew J. Child `AndrewJChild@churchofjesuschrist.org`, texts from 630-486-8838 | Area Seventy, US Central Area | **primary source of directives** |
| Jeremy Steele `jtsteele@churchofjesuschrist.org` / `jer_steele@outlook.com`, texts from 630-487-1645 | Executive Secretary to Elder Child | directives when he relays an ask; CC agendas and Trello notes are not items |
| Kevin Meldrum `Kevin.Meldrum@churchofjesuschrist.org` | Facilities Manager, Chicago Area | not area leadership; a concrete request Scott delegates becomes an `action` for the delegate |
| Justin Wood | Mission president | not area leadership — skip |
| `lufas@`, `noreply-finance`, `Communication@message`, `ces-endorsement`, `noreply-lcr` | automated | skip |

Also on the "Presidents" distribution and NOT sources: the other stake
presidents in the Chicago Coordinating Council (Mickelsen, Stradling,
Cieslak, Gollaher, Arguedas, Martin, Nussbaum, McKee, Olsen, Cropper, Pattee).
Their replies show what peers already answered — useful context, never items.

## Procedure

1. Gmail: `from:AndrewJChild@churchofjesuschrist.org newer_than:45d` (and the
   same for Jeremy Steele). Read only the **top message of each thread** by
   Elder Child/Jeremy; forwarded bodies below the separator are background.
   Read Scott's own replies in the thread — if he has already answered, the
   ask is closed and does not become an item.
2. iMessage: `read_imessages` for 630-486-8838 and 630-487-1645. Texts have
   so far only echoed the emails; still check them — a text can close an
   email ask (e.g. the missionary video was sent by text on Sep 10).
3. Dedupe against `magnify_items where source='email'` on
   `source_ref->>'gmail_thread'`.
4. Insert as below. Owner defaults to Scott (`41c69a38-…`); if Scott's reply
   already delegated it ("Brother Vielman will work with you"), make it an
   `action` owned by the delegate instead — the kind-by-owner trigger keeps
   presidency owners on `action`, HC owners on `assignment`.

| field | value |
|---|---|
| kind | `directive` (or `action` when delegated) |
| title | the ask, in one line, with the event date if there is one |
| detail | `{sender}, {Mon D} — {one line of context}` |
| due_on | the date the sender gave; the event date for save-the-dates; null when none |
| source / source_ref | `email` / `{"from","gmail_thread","subject"}` |
| review_state | `pending_review` |

Skip: reference material (Principles to Teach, posters without an ask),
approvals of Scott's own requests, calendar acknowledgements, anything
already answered in the thread.

## First run — 2026-09-13

Read 22 Elder Child threads (Aug 7 → Sep 11), 5 Jeremy Steele / Kevin
Meldrum threads, and both text conversations. Created **11 directives + 1
action**, all pending review:

- Hispanic Devotional Sep 20 — announce + invite 14–26s and YSAs (due 9/20)
- Missionary Fair weeknight activity, week of Sep 21 (due 9/21)
- Hyde Park broadcast setup for Bishop Pope's ward (due 9/18)
- Remember Him videos with EQ/RS presidents; confirm to Jeremy (due 9/30)
- Illinois youth-protection certification via bishops (due 9/8, already overdue)
- Education effort: assign a counselor/HC, consider a Stake Education Leader
- Couples to replace the Drurys (due 9/18)
- FSY: YM/YW presidents to drive registration
- Mission Leadership Seminar Zoom, Tue Oct 13 (due 10/13)
- Housing assistance >6 months: hold for final guidance; self-reliance plans now
- Confirm functioning Stake YSA Committee to Jeremy; share Elder Hirst's deck (due 9/16)
- **Action, Spencer Vielman:** gather interpreting receivers for Kevin Meldrum (due 9/16)

Already answered and therefore skipped: attendance estimate (100), pins
(10), Lucas as speaker (confirmed), YSA committee training attendance, the
missionary video (sent 9/10 by text), FSY couple thoughts, Hispanic-youth
mission barriers, Church Groups process feedback, multi-stake single adults
(on the CC agenda), Elder Child's Westchester visit (today).
