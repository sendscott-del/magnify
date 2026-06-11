export interface ChangelogEntry {
  version: string;
  date: string;
  enhancements: string[];
  bugFixes: string[];
}

// This file is auto-updated by scripts/generate-changelog.js on each deployment.
// To add release notes manually, add an entry to the array below.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.32.0',
    date: '2026-06-11',
    enhancements: [
      'The in-app Magnify mark now matches the real app icon — a navy tile with the white magnifying glass (it was showing a gold square with an upward arrow).',
      'Added the navy brand stripe under the top bar and tidied the header so it lines up with the rest of the Gathered suite.',
    ],
    bugFixes: [],
  },
  {
    version: '2.31.1',
    date: '2026-06-10',
    enhancements: [],
    bugFixes: [
      'Fixed the top Gathered bar overlapping the iOS status bar and Dynamic Island when running as the installed app — it now sits below them with a proper safe-area inset.',
    ],
  },
  {
    version: '2.31.0',
    date: '2026-06-10',
    enhancements: [
      'Access approvals now live in the Gather hub — the in-app Pending Access screen is read-only and links there.',
    ],
    bugFixes: [
      'Fixed a cross-app leak where signing into Magnify with an account from another app silently created a pending access request. Visitors without Magnify access now just see the pending screen; no rows are created.',
    ],
  },
  {
    version: '2.30.1',
    date: '2026-06-09',
    enhancements: [],
    bugFixes: [
      'Security: updated a development-tooling dependency (shell-quote) to a patched version. No app-facing changes.',
    ],
  },
  {
    version: '2.30.0',
    date: '2026-06-09',
    enhancements: [
      'Added the required disclaimer that Magnify is not an official product of, and is not endorsed by, The Church of Jesus Christ of Latter-day Saints, to the sign-in screen.',
    ],
    bugFixes: [],
  },
  {
    version: '2.29.0',
    date: '2026-06-08',
    enhancements: [
      'App Store review support: a designated reviewer account is automatically locked into Demo Mode on every data screen, so App Store reviewers only ever see sample data — never real member callings or names.',
    ],
    bugFixes: [],
  },
  {
    version: '2.28.0',
    date: '2026-06-08',
    enhancements: [],
    bugFixes: [
      "Fixed a cross-app leak where Sparkle Pro signups appeared in Magnify's Pending Access queue. Magnify and Sparkle Pro share one physical `profiles` table; the signup trigger tagged each row's app but the table had no `app` column to store it, so Magnify's \"pending\" query surfaced Sparkle requests (and an Approve/Reject could mutate a Sparkle row). Added an `app` column, the trigger now stamps it, existing rows were backfilled, and every Magnify profiles list query is now scoped to app='magnify'. See supabase/migrations/20260608_scope_profiles_by_app.sql.",
    ],
  },
  {
    version: '2.27.0',
    date: '2026-06-08',
    enhancements: [
      'Domain migration: Magnify now lives at https://magnify.gatheredin.app — the new Gathered suite domain. The old magnify-eta.vercel.app URL keeps working and redirects here, so existing links and home-screen shortcuts are not broken. The in-app App Switcher and deep-link handling now use the *.gatheredin.app addresses for all five Gathered apps (Magnify, Steward, Glean, Tidings, Knit).',
      'Password-reset and Slack "View Card" links now build on an absolute https://magnify.gatheredin.app base (via EXPO_PUBLIC_APP_URL) instead of a relative path, so reset emails and notifications point at the correct domain.',
    ],
    bugFixes: [],
  },
  {
    version: '2.26.0',
    date: '2026-05-31',
    enhancements: [
      "AuthContext signUp now passes `data: { app: 'magnify' }` so the shared handle_new_user trigger (rewritten in parallel) only writes to Magnify's profiles table for users who actually signed up through Magnify. Cross-app signups (Knit, Glean, Steward, etc.) no longer create pending profiles rows that show up in Magnify's Pending Access queue. Required because the trigger is now strict — untagged signups insert nothing — so without this tag, new Magnify signups would not land in profiles and the Pending Access flow would silently break.",
    ],
    bugFixes: [],
  },
  {
    version: '2.25.0',
    date: '2026-05-25',
    enhancements: [
      'WebShell sidebar active state now uses white-on-white-translucent (`rgba(255,255,255,0.15)` background, full-white label, inactive labels stay at 75% white) — matches Knit/Glean/Steward/Tidings sidebars pixel-for-pixel. Spec pitfall §m2: "Gold is reserved for the brand mark and the FAB." Previous gold-tinted active fill broke that rule.',
      'Calling-detail right-rail action panel shrinks from 220px → 200px (spec mockup width). Content padding-right drops to 232px to match. Rail stays absolute-positioned because Expo Web body has `overflow:hidden` and each screen owns its own ScrollView — there\'s no scrolling ancestor for `position:sticky` to anchor against, so absolute gives the same "stays visible" behavior.',
      'Sustain-stage advance button now flips to gold (`Colors.accent`, new `accent` Button variant). Spec §4 calls this Magnify\'s "moment of completion" flourish — the only place gold fills (instead of bordering) a primary CTA. Only triggers when `calling.stage === "sustain"`; every other stage keeps the navy primary.',
      '`app.json` gains `scheme: "magnify"`. The linking config already advertised `magnify://` as a prefix but native deep links couldn\'t resolve without the scheme declaration — fixed.',
    ],
    bugFixes: [
      'Native SuggestionFAB grows from 44px → 56px (spec §m6 mandates 56-px on native). Bottom offset also bumps from 80 → 90 to clear the iOS home indicator. Desktop web stays at 40px in the corner.',
    ],
  },
  {
    version: '2.24.1',
    date: '2026-05-25',
    enhancements: [],
    bugFixes: [
      "Web kanban: columns no longer overflow into their neighbors at 1280px wide (in v2.24.0 Sustain cards visibly slid under Set Apart). KanbanColumn had a hardcoded width:280 + marginRight that fought the CSS Grid's cell sizing. Added a fluid prop that the desktop-web path passes — column then fills its grid cell instead of forcing 280px. Native horizontal-scroll mode (phone) unchanged.",
    ],
  },
  {
    version: '2.24.0',
    date: '2026-05-25',
    enhancements: [
      'Web parity + suite alignment (Phase 6). Magnify on a desktop browser was previously the native UI stretched edge-to-edge: the bottom tab bar grew to 1920px, the kanban scrolled horizontally even with room for every column, and the SuggestionFAB covered the last calling card. This release adds a real desktop shell — a 224px navy sidebar at md+ on web only — that puts Magnify on the same chrome the rest of the Stake Suite (Knit / Glean / Tidings / Steward) just adopted. iOS + Android are unchanged; phone-width browsers still get the bottom tab bar.',
      'New WebShell layout (navigation/WebShell.tsx) — sidebar with New / SP Board (presidency-gated) / HC Board / Completed / Settings up top, User Guide + Release Notes underneath, gold-accent active state. Drives navigation via React Navigation\'s nested-screen syntax so the inner stack tree stays correct. Brand mark + Magnify wordmark at top match the per-app chrome the other four apps use.',
      'WebStackNavigator (navigation/WebStackNavigator.tsx) — flat NativeStack that registers every leaf screen the tab navigator does, plus the CallingDetail / Help / ReleaseNotes / SlackSettings / PendingAccess screens, so the sidebar can reach all of them. Initial route picks PresidencyMain for presidency/clerk users and HCMain otherwise — same default the tab navigator lands on.',
      'Kanban → responsive CSS Grid on web at md+ (PresidencyKanbanScreen + HCKanbanScreen). Columns use repeat(auto-fit, minmax(220px, 1fr)) so 4 fit at 1024px and 8 at 1280px — no horizontal scroll. Native phone view still uses ScrollView horizontal.',
      'Calling detail (CallingDetailScreen) gets a sticky right-rail action panel on desktop web (220px, top-right, absolute-positioned so it stays visible while the form scrolls). Inline actions block is suppressed on desktop so Mark approved / Decline / Move back don\'t render twice. Native + phone-width web keep the existing inline-at-bottom placement.',
      'SuggestionFAB shrinks to 40px and anchors at bottom-18/right-18 on desktop web; native + phone web keep the existing 44px / bottom-80 placement. Now accepts controlledOpen + onControlledClose props for suite-wide parity with Knit / Glean / Steward / Tidings — a future Settings row could open the modal without a separate floating button.',
      'React Navigation linking config — every screen has a real URL: /new, /board, /hc, /completed, /settings, /guide, /release-notes, /settings/slack, /calling/:id. Bookmarking the SP board or sharing a calling-detail URL now works on web. Native deep links via magnify:// share the same prefixes.',
      'Forms (shared Input component + SuggestionFAB textarea) use 16px font on web only via Platform.OS check. Native keeps the design-system 15px. Prevents iOS Safari from auto-zooming when Magnify is installed as a PWA.',
      'New lib/useDeviceWidth.ts hook — single source of truth for "are we on desktop web?". useIsDesktopWeb() returns Platform.OS === "web" && width >= 768. Updates live on browser resize so hot-resizing between phone and desktop widths swaps shells smoothly.',
    ],
    bugFixes: [],
  },
  {
    version: '2.23.1',
    date: '2026-05-24',
    enhancements: [],
    bugFixes: [
      "\"Just mine\" filter and the home-screen badge no longer hold onto cards from prior stages. When a calling advances (e.g., out of Extend Calling and into Sustain), the previous-stage assignee drops off — only the assignee for the calling's current stage counts as \"mine.\" Before, a card stayed in your view for every step you'd touched along the way, even after you'd handed it off. Applies to the HC board, the in-app badge count, and the silent push that updates the home-screen badge.",
    ],
  },
  {
    version: '2.23.0',
    date: '2026-05-24',
    enhancements: [
      'High Council board "Just mine" filter now includes the Sustain column. A high councilor with assigned wards sees every card that still needs sustaining in any of their wards — ward callings for those wards, plus stake callings whose per-ward sustaining hasn\'t been checked off yet for any of their wards. Same fall-through pattern as HC Approval. The home-screen badge count and silent push updates mirror the same rule, so the number on the icon matches what\'s on the board.',
      'Ward coverage for each high councilor is now managed from the Gathered admin page (Manage user access → High councilor ward coverage). One click per ward chip to assign or remove. Backed by a new hc_member_wards table in the shared Supabase project; readable by any approved Magnify user and writable by stake admins or Gathered super-admins.',
    ],
    bugFixes: [],
  },
  {
    version: '2.22.1',
    date: '2026-05-23',
    enhancements: [],
    bugFixes: [
      "Removed the in-app User Roles screen entirely (the 'Opening Gather…' placeholder was getting restored from React Navigation persisted state on PWA reloads, so users were landing on it every time they opened Magnify). The Settings → Manage user access menu item still opens the standalone Gather page in the browser via Linking.openURL — same behavior as v2.22.0, but the dead intermediate screen is gone so it can't be navigated to anymore.",
    ],
  },
  {
    version: '2.22.0',
    date: '2026-05-23',
    enhancements: [
      "Settings → Manage user access now opens the standalone Gather page (https://gathered-admin-neon.vercel.app/gather) in your browser instead of the in-app User Roles screen. Why: one canonical place to manage user access across all five Gathered apps — Magnify, Steward, Glean, Tidings, Knit — with app-access toggles, super-admin + per-app admin powers, and the 19 suite roles all in one redesigned row + side-panel UI. The native User Roles screen still exists as a safety net (auto-opens the same browser URL) for old nav-history links.",
    ],
    bugFixes: [],
  },
  {
    version: '2.21.1',
    date: '2026-05-23',
    enhancements: [
      'User Roles screen header now reads "User Roles" (was "Manage Members") — matches the Settings entry that opens it.',
      'User Guide audited against the redesigned Settings tab: Slack section, Stake Clerk / Executive Secretary role descriptions, and the "How do I add a user?" / "How do I add Slack notifications?" FAQ entries all updated to reference Settings → User roles and Settings → Pending access (the old "Manage Users" / "Manage HC Members" / "Manage Stake Presidency Members" paths are gone). New User Guide sections cover the Settings tab layout and the unified User Roles screen, plus a new FAQ entry on how to set a Slack User ID so @-mentions land. Both English and Spanish updated.',
    ],
    bugFixes: [],
  },
  {
    version: '2.21.0',
    date: '2026-05-23',
    enhancements: [
      'Settings tab redesigned around a single consistent row pattern — every action is the same shape, so the mix of full-width outline buttons / segmented controls / inline cards is gone. Sections: profile card, Admin (pending access, user roles), Integrations (Slack notifications), Preferences (language as inline segment, demo mode as inline toggle), Help, App (refresh, manage Gather, sign out). Pending users and Slack webhooks moved to their own screens reachable from the new rows.',
      'User Roles screen collapses the old Users / Stake Presidency / High Council tabs into one unified list. Every person shows name, email, role, and Slack ID in one row; the edit sheet handles all four fields and writes back to whichever underlying table (profiles, sp_members, high_council_members) the person belongs to. Role changes between SP and HC roles auto-migrate the person between rosters so Slack @-mentions and kanban assignment stay consistent. "Suite" tab (the 19 cross-app Gathered roles) is preserved as a second tab.',
      'Access Permissions button retired from Settings — the full permissions matrix is now a section inside the User Guide. PermissionsTableScreen, SPAdminScreen, and HCAdminScreen files removed; the latter two were already dead imports.',
    ],
    bugFixes: [],
  },
  {
    version: '2.20.0',
    date: '2026-05-22',
    enhancements: [
      'User Roles screen has a new "Suite" tab alongside Users / SP / HC. Lets stake-suite super admins assign any of the 19 Gathered roles to any signed-in user — Stake President through Ward Member. Multi-role-per-person; ward-scoped roles get a ward chip picker. Writes to the shared `gather_user_roles` table — same source of truth Glean / Knit / Steward read from and that Tidings syncs into. Existing Magnify-specific role plumbing (`profiles.role`, sp_members, hc_members) is unchanged; the suite tab layers on top for cross-app visibility.',
    ],
    bugFixes: [],
  },
  {
    version: '2.19.1',
    date: '2026-05-20',
    enhancements: [],
    bugFixes: [
      'Push notifications restored. The Supabase VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY secrets had been overwritten during a sibling app\'s push setup, breaking every existing Magnify push subscription. The original keypair was recovered from the local .vapid-keys.txt backup and re-set as the Supabase secret. constants/push.ts is unchanged — existing subscriptions resume working immediately, no user action required. The sibling app has been moved to a prefixed env-var namespace so this cannot recur.',
    ],
  },
  {
    version: '2.19.0',
    date: '2026-05-20',
    enhancements: [
      'Suggestion FAB now also writes to the shared cross-app inbox and emails Scott. The bottom-right lightbulb has always posted to Slack; it now additionally POSTs to the new `submit-suggestion` edge function on the Gathered Supabase project, which writes a row to `public.app_suggestions` and emails Scott via Resend. Magnify joins Glean, Steward, Knit, and Tidings in feeding one tracker you can mark `in_progress` / `implemented` / `declined`. Slack delivery is unchanged — both fire in parallel and either failing does not block the user.',
    ],
    bugFixes: [],
  },
  {
    version: '2.18.4',
    date: '2026-05-19',
    enhancements: [
      'Favicon (browser tab + Chrome bookmark bar) now matches the home-screen icon. Expo\'s web template was emitting a `<link rel="icon" href="/favicon.ico" />` but we never generated a favicon.ico — browsers either 404\'d or fell back to a stale cached icon. The postbuild script now rewrites that link to point at /favicon.png (regenerated from the current navy-+-white-magnifier master).',
    ],
    bugFixes: [],
  },
  {
    version: '2.18.3',
    date: '2026-05-19',
    enhancements: [
      'Magnify glyph recolored from gold to white. The navy background is unchanged; the magnifying glass on the home-screen icon and the in-app MagnifyLogo are now white instead of gold. Aligns with the suite-wide rule that default icons are brand color + white glyph; iOS Tinted (sleep) mode then renders white-on-color as the gold-on-black look the user wants there.',
    ],
    bugFixes: [],
  },
  {
    version: '2.18.2',
    date: '2026-05-19',
    enhancements: [
      'In-app MagnifyLogo updated to match the v2.18.1 home-screen icon. The rounded navy square no longer carries the white-"M" letterform; instead it holds a large gold magnifying glass — the same glyph the new PWA icon uses. The "Magnify" wordmark continues alongside in headers and the login card.',
    ],
    bugFixes: [],
  },
  {
    version: '2.18.1',
    date: '2026-05-18',
    enhancements: [
      'Home-screen / PWA icon redesigned: navy background (matching the Gathered "M" chip) with a large gold magnifying glass replacing the white "M" letter. Same treatment is rolling out across the suite — each app\'s icon is now its brand color + its gold accent shape, instead of every icon being a dark blue letter. assets/icon.png, adaptive-icon.png, splash-icon.png, and favicon.png all regenerated from a single icon-master.svg.',
    ],
    bugFixes: [],
  },
  {
    version: '2.18.0',
    date: '2026-05-18',
    enhancements: [
      'Suite consistency pass (1/5): the Gathered top bar now carries an EN/ES toggle on every screen, matching the pattern already established in Tidings. Language preference still syncs to your profile and persists across devices — the toggle just moves out of Settings so you can switch one-handed.',
      'Suite consistency pass: scripture banner. A slim line under the Gathered chrome now carries Magnify\'s namesake verse — "We did magnify our office unto the Lord." (Jacob 1:19) — so the app\'s name has a visible origin everywhere it travels, matching the pattern Steward already uses.',
      'Browser tab title is now locked to "Magnify" across every screen. Previously the tab read "HC Main" / "Presidency" / etc. depending on which screen you were focused on, which broke the home-screen-shortcut and tab-history experience.',
      'Settings → Help & Documentation renamed to Settings → User Guide. Same content, naming aligned with the rest of the suite.',
    ],
    bugFixes: [],
  },
  {
    version: '2.17.0',
    date: '2026-05-10',
    enhancements: [
      'Demo mode now stays in demo mode: opening a demo card from either board renders the fixture detail without hitting the database (it was showing "not found"), and the New Calling form no longer secretly inserts a real row when you submit while demo mode is on.',
      'Demo fixtures now show every column: cards across all six HC stages — including Ordained and Record — appear when demo mode is on, and every card finally shows the calling name (a field-name mismatch was leaving that slot blank).',
      'Deep links land on the right tab: opening a /calling/:id link now drops you into the SP board for early-stage callings (ideas / for approval / stake approved), the HC board for HC-stage callings, and the Completed list for completed ones. Previously every deep link forced you under the HC tab.',
    ],
    bugFixes: [
      'Fixed TypeScript 5.7+ type error on the VAPID key passed to PushManager.subscribe (web push subscribe path).',
      'Fixed brittle "as never" cast on the deep-link navigate call that produced a strict-TS error.',
      'Revoked anonymous and authenticated RPC EXECUTE on magnify_notify_push() — the trigger function should fire from the row trigger only, not be callable as a public REST RPC. Clears Supabase advisors 0028/0029.',
    ],
  },
  {
    version: '2.16.2',
    date: '2026-05-10',
    enhancements: [
      'SP Board "Just mine" toggle: a matching pill on the Stake Presidency board collapses the view to cards that need your action — anything in For Approval (if you are presidency or a clerk), plus any card where your name is in extend / sustain / set apart / record. Same one-tap toggle as the HC board version.',
    ],
    bugFixes: [],
  },
  {
    version: '2.16.1',
    date: '2026-05-10',
    enhancements: [
      'HC Board "Just mine" toggle: a new pill at the top of the filter row instantly filters the board to cards assigned to you. Tap again to see everyone. Only shows up if your name is on the Stake Presidency or High Council list. Previously you had to open the assignee dropdown and find your own name — now it is one tap.',
      'HC Board filter clarity: the assignee filter chip now reads "All people" instead of just "All", so it is obvious what the chip filters.',
    ],
    bugFixes: [],
  },
  {
    version: '2.16.0',
    date: '2026-05-05',
    enhancements: [
      'Home-screen badge notifications: when a calling needs your action, a red number badge now appears on the Magnify icon on your phone home screen, even when the app is closed. Tap the new "Get a home-screen alert" banner on the HC board to enable. Counts the same cards as the in-app HC and SP badges (extend / sustain / set apart / record assignees, plus HC Approval cards you haven\'t checked off, plus For Approval for Presidency/Clerks).',
      'PWA basics: Magnify now ships a real web app manifest and service worker, so "Add to Home Screen" produces a proper installed app on iOS and Android. Theme color, app name, and standalone display are all wired up.',
      'Help screen: new "Home-screen badge" section explains how to install the PWA and enable notifications on iPhone vs. Android.',
    ],
    bugFixes: [],
  },
  {
    version: '2.15.0',
    date: '2026-05-04',
    enhancements: [
      'Tab badges for action items: the HC Board and SP Board tabs now show a red badge with the number of cards waiting on you. The HC badge counts cards where your name is in extend / sustain / set apart / record, plus HC Approval cards you have not yet checked off (HC members only). The SP badge counts cards in For Approval (visible to Stake Presidency and Clerks). Badges update automatically when a board refreshes.',
    ],
    bugFixes: [],
  },
  {
    version: '2.14.5',
    date: '2026-05-04',
    enhancements: [],
    bugFixes: [
      'Gathered switcher: Tidings URL corrected from tidings.vercel.app to glad-tidings.vercel.app (the previous URL pointed at someone else\'s project).',
    ],
  },
  {
    version: '2.14.4',
    date: '2026-05-04',
    enhancements: [],
    bugFixes: [
      'Gathered switcher: use canonical short URLs for Magnify (magnify-eta.vercel.app) and Tidings (tidings.vercel.app) instead of the team-scoped URLs. Same destinations, cleaner links.',
    ],
  },
  {
    version: '2.14.3',
    date: '2026-05-04',
    enhancements: [
      'AppSwitcher chrome color moved from hardcoded #1e1b4b to Colors.switcherChrome in constants/theme.ts for consistent token-based theming.',
    ],
    bugFixes: [],
  },
  {
    version: '2.14.2',
    date: '2026-05-03',
    enhancements: [],
    bugFixes: [
      'Gathered switcher: tapping another app on the web build now navigates the current tab instead of opening a new browser tab. On native (iOS/Android) the behavior is unchanged — Linking.openURL still opens the system browser, which is correct since the other apps live on the web.',
    ],
  },
  {
    version: '2.14.1',
    date: '2026-05-03',
    enhancements: [],
    bugFixes: [
      'Edit Calling Details now lets you keep (or enter) a custom calling name. The Calling picker has always had an "Other" option for callings that aren\'t in the predefined list (e.g. "Assistant Camp Director"), but the edit modal was only honoring "Other" for the New Calling flow — in the edit modal it would either drop the original custom name or leave Save disabled with no way to recover. Now: when you open Edit Calling Details on a custom calling, the picker shows "Other" and a text input below it is pre-filled with the existing custom name. When you switch the Type chip (Ward / Stake / MP), pick "Other" from the new picker and the same text input appears so you can type the calling name. Save is enabled as soon as a name is filled in',
    ],
  },
  {
    version: '2.14.0',
    date: '2026-05-03',
    enhancements: [
      'Demo-aware calling detail screen — tapping a card on the SP Board, HC Board, or Completed Callings list in demo mode now opens the full detail screen instead of a read-only Alert. The screen loads the fixture calling, renders the same UI as a real calling, and short-circuits every mutation handler (advance stage, decline, set apart, toggle SP/HC approval, assign, ward sustaining toggle, delete, unreject) so demo activity never reaches Supabase or Slack. A bold "DEMO — CHANGES STAY IN-MEMORY ONLY" strip across the top makes the mode visible. Trainers can now walk through the full calling workflow in demo, tap-by-tap, just like the real thing',
    ],
    bugFixes: [],
  },
  {
    version: '2.13.1',
    date: '2026-05-03',
    enhancements: [],
    bugFixes: [
      'Edit Calling Details: the Save button now disables itself when required fields are empty instead of silently ignoring the tap. Switching the Type chip (Ward / Stake / MP) deliberately clears the Calling field — ward and stake have different available callings — but the previous version just dropped the click on the floor when Save was pressed with no calling chosen, with no feedback. Save now visibly greys out until you pick a new calling',
      'Sustaining script on the High Council board now includes stake callings in every ward’s script, not just the member’s home ward. Stake callings (and their releases) are sustained in all wards in the stake, so each ward’s sacrament-meeting script now lists them alongside that ward’s own callings. The calling-count badge on the ward picker reflects this too — picking any ward shows the combined total of that ward’s callings plus all stake-wide ones',
    ],
  },
  {
    version: '2.13.0',
    date: '2026-05-03',
    enhancements: [
      'Demo mode is now read-only safe on the kanban: tapping a calling card from the SP Board, HC Board, or Completed Callings list now shows a small alert with the card\'s member, calling, ward, stage, and type instead of opening the detail screen. Detail screen has many mutation handlers (advance stage, decline, set apart, etc.) that would silently target the real DB if entered with a fixture id; this guards that path entirely. A demo-aware detail screen is a follow-up',
    ],
    bugFixes: [],
  },
  {
    version: '2.12.0',
    date: '2026-05-03',
    enhancements: [
      'Demo mode now actually shows demo data: turning the banner on swaps the SP Board, HC Board, and Completed Callings screens to a fixture of 14 callings spread across all 9 workflow stages — Ideas through Complete — including one declined calling for the rejected list. Wards default to a five-ward fixture (HP1 / HP2 / MW / CH2 / WC2) and SP / HC member rosters get realistic placeholder names. The role pill in the banner cycles through every leadership role for storytelling. Real and demo coexist on the same device — demo data never touches the database',
    ],
    bugFixes: [],
  },
  {
    version: '2.11.0',
    date: '2026-05-03',
    enhancements: [
      'Settings now has a "Manage Gather user access ↗" button (Stake President / Stake Clerk only) that opens the canonical /admin/gather screen in Steward in a new tab. Magnify is React Native and the cross-app admin UI lives in the Tailwind-based suite apps; pointing super-admins at the version in Steward keeps everyone managing access from one place',
    ],
    bugFixes: [],
  },
  {
    version: '2.10.0',
    date: '2026-05-03',
    enhancements: [
      'Demo mode: a striped amber banner appears at the top of every Magnify screen when demo mode is on, with a tappable role pill that cycles through every leadership role (Stake President, 1st/2nd Counselor, High Councilor, Stake Clerk, Executive Secretary, member) so trainers can talk through what each role experiences without exposing real ward data. Toggle it from Settings → "Enable demo mode" / "Exit demo mode". State persists in AsyncStorage so demo and real coexist on the same device',
    ],
    bugFixes: [],
  },
  {
    version: '2.9.0',
    date: '2026-05-03',
    enhancements: [
      'Gather suite app switcher: the "Gathered" jump bar now lists all five sibling apps — Magnify, Steward, Glean, Tidings, and Knit — instead of just two. Each one renders as a brand-colored letter chip with a one-line blurb, and the bar only shows the apps you actually have access to (read from the shared user_apps table)',
      'Cross-app super-admin: the Stake President and Stake Clerk now have a single source of truth for who can use which app, stored in the shared gather_super_admins + user_apps tables. The Gathered switcher in every app reads from these, so granting access in one place lights up the right apps everywhere',
    ],
    bugFixes: [],
  },
  {
    version: '2.8.1',
    date: '2026-05-02',
    enhancements: [],
    bugFixes: [
      'Fixed a long-standing bug where clicking inside any bottom-sheet modal on the calling-detail screen — Edit Calling Details, Decline, the ward picker, the calling picker, the task-assignee picker, and the release ward picker — would dismiss the modal and (on web) sometimes pop you all the way back to the kanban board. Replaced the brittle dismissal pattern (`onStartShouldSetResponder`) with `Pressable`-based click absorption, which works reliably on both native and react-native-web. You can now tap into form fields without the modal closing on you',
    ],
  },
  {
    version: '2.8.0',
    date: '2026-05-02',
    enhancements: [
      'Edit Calling Details now lets you change the calling type (Ward / Stake / MP Ordination), not just the name and ward. Useful for fixing a card created under the wrong type without deleting and re-adding it. Switching to MP auto-generates the calling name from the ordination type and clears the Bishop-approved flag; switching away from MP clears the ordination type so you can pick a regular calling. If the new type makes the current workflow stage invalid (e.g. moving an idea to MP, which skips the Ideas/For Approval/Stake Approved stages), the card is bumped forward to the nearest valid stage and the change is recorded in the audit log',
    ],
    bugFixes: [],
  },
  {
    version: '2.7.3',
    date: '2026-04-29',
    enhancements: [
      'Steward icon in the Gathered AppSwitcher now uses the new Steward mark (white S with a gold checkmark) instead of the old logo, so cross-app navigation matches the rebrand',
    ],
    bugFixes: [],
  },
  {
    version: '2.7.2',
    date: '2026-04-29',
    enhancements: [
      'Home-screen icon, favicon, splash screen, and Android adaptive icon all updated to the new Magnify mark — clean white "M" letterform with a gold magnifying lens on the deep navy brand background. Replaces the older photographic logo at every OS-level surface',
    ],
    bugFixes: [],
  },
  {
    version: '2.7.1',
    date: '2026-04-29',
    enhancements: [
      'AppSwitcher (the Gathered bar at the top showing other apps you have access to) now uses the new SVG Magnify logo for the Magnify entry instead of the old photographic PNG',
    ],
    bugFixes: [],
  },
  {
    version: '2.7.0',
    date: '2026-04-29',
    enhancements: [
      'New Magnify logo — clean "M" letterform with the magnifying lens nested in the upper-right counter, rendered as a crisp SVG instead of the old photographic PNG. Used across Login / Register / Forgot Password / Reset Password',
      'New product icons — Ward (chapel), Stake (larger chapel), MP Ordination (priesthood key), SP Board (stacked workflow cards), HC Board (12-dot council grid). Flat SVG glyphs in dark navy squircles, replacing the old photographic icons. Visible on the bottom-tab navigator (SP Board / HC Board), the New Calling type selector, and the Calling Detail header',
      'Calling cards on the kanban boards have been redesigned: the photographic icon is replaced with a 40×40 ward-abbreviation badge (e.g., "HP1" in monospace) — navy for ward callings, dark navy for stake callings, gold for MP ordinations. The "NEW" red badge becomes a small gold dot. The footer adds a top-border divider with the type label (mono uppercase) on the left and a colored stage dot + plain-text stage on the right',
    ],
    bugFixes: [],
  },
  {
    version: '2.6.0',
    date: '2026-04-29',
    enhancements: [
      'Auth screens redesigned to match the design system: Login, Register, Forgot Password, and Reset Password now lead with a deep navy hero band (logo + Magnify name + tagline + screen heading), with the white form card overlapping the bottom of the hero. Replaces the previous plain-white treatment',
      'Login screen now has an English / Español language toggle directly below the form so users can switch language before signing in (previously buried in Settings)',
    ],
    bugFixes: [],
  },
  {
    version: '2.5.3',
    date: '2026-04-29',
    enhancements: [
      'Accessibility — icon-only buttons (delete, close, set Slack ID, clear search, back) now have larger 50×50 hit areas and screen-reader labels, so they meet the design system\'s 44×44 minimum without changing the visual layout',
    ],
    bugFixes: [],
  },
  {
    version: '2.5.2',
    date: '2026-04-29',
    enhancements: [
      'Spanish coverage filled in for the remaining English-only labels: Calling Detail (Details / Type / Bishop / Approved ✓ / Created / Completed / Actions / no-actions message), the Release Member edit form (Cancel / Save / Saving / Select ward), the New Entry confirmation banner (Submitted / Submit Another / HC Board), the Suggestion FAB modal, and the Permissions table "Cond." cell',
    ],
    bugFixes: [],
  },
  {
    version: '2.5.1',
    date: '2026-04-29',
    enhancements: [
      'Calling-type colors (ward / stake / MP) now live as named tokens on the theme so the three boards stay in sync — no more hex literals duplicated across CallingCard, CallingDetail, and Completed screens',
    ],
    bugFixes: [],
  },
  {
    version: '2.5.0',
    date: '2026-04-18',
    enhancements: [
      'Sustaining script groups multiple MP ordinations of the same office into a single proposal — e.g., "It is proposed that Brothers A and B receive the Melchizedek Priesthood and be ordained to the office of Elder" followed by one vote instead of separate motions per person',
    ],
    bugFixes: [],
  },
  {
    version: '2.4.0',
    date: '2026-04-12',
    enhancements: [
      'Left Field Labs app switcher — users with access to multiple apps (Magnify, Steward, Duty) see a toggle bar at the top to switch between them',
    ],
    bugFixes: [],
  },
  {
    version: '2.3.0',
    date: '2026-04-12',
    enhancements: [
      'Edit calling details — member name, calling, ward, and more can now be updated after creation, with changes logged to the activity log',
      'Comprehensive permissions rewrite — advance buttons now only appear for users who have authority to move a calling at each stage',
      'New callings always start in Ideas — only the Stake President can submit for approval',
      'HC board: advance buttons respect >50% HC approval threshold and task assignments',
    ],
    bugFixes: [],
  },
  {
    version: '2.2.0',
    date: '2026-04-12',
    enhancements: [
      'Added "Forgot password?" flow — users can now reset their password via email link',
    ],
    bugFixes: [],
  },
  {
    version: '2.1.1',
    date: '2026-04-02',
    enhancements: [],
    bugFixes: [
      'Fixed role chips getting cut off on narrow phone screens in User Roles — now horizontally scrollable',
    ],
  },
  {
    version: '2.1.0',
    date: '2026-03-30',
    enhancements: [
      'Split Slack webhooks: separate channels for user access requests vs approvals',
      'Consolidated admin: SP Members and HC Members now managed in the same screen as User Roles (3 tabs)',
      'Removed separate SP Admin and HC Admin screens — all management in one place',
      '"Manage Members" button in Settings replaces three separate buttons',
    ],
    bugFixes: [],
  },
  {
    version: '2.0.0',
    date: '2026-03-30',
    enhancements: [
      'Complete Spanish translation audit — all 28 hardcoded English strings now use translation system',
      'Release section fully translated (member name, current calling, ward picker, status labels)',
      'Ordination labels (Elder/High Priest) translated',
      'Validation messages, success alerts, and activity log entries translated',
      'Admin screens (Settings, SP Admin, HC Admin, User Roles) error alerts translated',
      'Slack webhook test messages translated',
    ],
    bugFixes: [
      'Fixed "Assign role:" label not translating in pending user management',
      'Fixed "Select Ward (Release)" modal title not translating',
      'Fixed "No ward / not applicable" picker option not translating',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-03-30',
    enhancements: [
      'New User Roles admin screen — view all approved users and change their assigned roles',
      'Revoke access option to remove a user without deleting their account',
      'Accessible from Settings > Leadership for Stake Presidency, Stake Clerk, and Executive Secretary',
    ],
    bugFixes: [],
  },
  {
    version: '1.8.0',
    date: '2026-03-29',
    enhancements: [
      'Member to be Released section now has a "Mark as released" checkmark — tap it to confirm the release is done; it turns green when complete',
    ],
    bugFixes: [
      'Fixed app navigating back to the New Entry tab whenever you switch browser tabs or apps — it now stays on whichever screen you were on',
      'Corrected Spanish sustaining script: "LIBERACIONES" → "RELEVOS", "liberar" → "relevar", fixed in-favor and opposed vote wording, fixed "guion" spelling',
      'Releases in Spanish now read "Los que deseen manifestar su agradecimiento…" instead of asking for a vote',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-03-29',
    enhancements: [
      'Calling picker now filters by type — ward callings show only Bishopric and Elders Quorum options; stake callings show only Stake options',
      'Role is no longer selected on the registration screen — approvers now assign the correct role at approval time to prevent mistakes',
      'Approver can select a role for each pending user directly in Settings before tapping Approve',
    ],
    bugFixes: [
      'Sustaining script no longer asks for an opposing vote on releases — releases now end with "Thank you." per GHB 30.3',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-03-29',
    enhancements: [
      'Sustaining Script is now fully translated to Spanish — all wording, headers, and motions update when language is set to Spanish',
      'Stake Clerk and Executive Secretary can now be added to the Stake Presidency Members admin page (Settings \u2192 Manage Stake Presidency Members)',
      'Assignee filter labels on the HC Board now display in the correct language',
      'Added two new ward callings: Assistant Ward Clerk Finance and Assistant Ward Clerk Membership',
      'Help documentation updated: HC Board section now describes the Sustaining Script; Slack section explains @mention setup',
    ],
    bugFixes: [
      'Fixed sustaining script showing English text regardless of language setting',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-03-29',
    enhancements: [
      'Slack notifications now fire immediately when a user requests access (previously only on approval)',
      'Slack links to cards now navigate directly to the card, even if you need to log in first',
      'Slack notifications now @mention the assigned member when a card advances to their step (e.g. extend calling, sustain, set apart)',
      'HC Admin and SP Admin screens now support setting a Slack User ID per member — tap the @ icon on any member row to configure',
      'Language preference now follows your account across all devices — set it once in Settings and it applies everywhere you log in',
    ],
    bugFixes: [],
  },
  {
    version: '1.4.0',
    date: '2026-03-29',
    enhancements: [
      'Member to be Released section on calling cards — capture name, current calling, and ward from card creation through all stages',
      'Sustaining Script generator on the HC Board — tap the button at the top of the Sustain column, select a ward, and get a GHB 30.3-formatted script ready to read from the pulpit',
      'Sustaining script includes releases first (for any calling with a release member attached), then all sustainings for that ward',
      'Copy-to-clipboard button on the sustaining script for easy transfer to phone or notes',
    ],
    bugFixes: [],
  },
  {
    version: '1.3.0',
    date: '2026-03-29',
    enhancements: [
      'Full Spanish language support — switch between English and Spanish in Settings',
      'Language preference is saved and persists across sessions',
      'All screens, modals, labels, and buttons are fully translated',
      'Kanban columns now scroll when content fills the screen',
    ],
    bugFixes: [],
  },
  {
    version: '1.2.0',
    date: '2026-03-29',
    enhancements: [
      'Idle session timeout: automatic sign-out after 15 minutes of inactivity with a 3-minute warning',
      'Navigation state is now persisted — returning to the app after switching browser tabs restores your last page',
      'Ward sustaining checkboxes for stake callings now gate advancement; SP, Counselors, Clerk, and Exec Secretary can override',
      'Stake Presidency, Stake Clerk, and Executive Secretary can now move callings back one stage',
      'Stake Presidency, Stake Clerk, and Executive Secretary can now delete callings',
      'Disclaimer added to all pages: not an official Church app',
      'Custom icons replaced with improved versions across all views',
      'Access permissions table updated to reflect new Move Back and Delete permissions',
      'Legend on permissions table no longer cuts off text',
      'Icons on cards and tab bar increased in size for better visibility',
    ],
    bugFixes: [
      'Fixed legend text being cut off on the Access Permissions screen',
      'Ward sustaining section now refreshes correctly without a separate fetch cycle',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-03-29',
    enhancements: [
      'Slack messages now include a direct link to the card and show who made the change',
      'Slack notifications sent when a user requests access or is approved',
      'New button moved to leftmost tab for quicker access',
      'Added Help & Documentation screen with role descriptions, workflow stages, and FAQ',
      'Release Notes screen now available in Settings',
      'HC Board filter now shows cards pending your HC approval when filtering by assignee',
      'Added User Access Requests & Approvals Slack webhook setting',
      'Improved home screen icon on Safari iOS (PWA)',
    ],
    bugFixes: [
      'Fixed brief flash of the Pending Approval screen after logging in as an approved user',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-01-01',
    enhancements: [
      'Initial release of Magnify',
      'SP Board with Ideas, For Approval, and Stake Approved columns',
      'HC Board with full calling workflow (HC Approval through Record)',
      'Role-based access for Stake Presidency, High Councilors, Clerk, and Executive Secretary',
      'Slack webhook notifications for SP Board updates, HC Board updates, and rejections',
      'Ward and assignee filters on the HC Board',
      'Calling log with full audit trail',
      'Ward sustaining tracking',
    ],
    bugFixes: [],
  },
];
