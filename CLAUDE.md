# Magnify — current state

> Read this before touching the app. Update it the MOMENT an infra fact changes (database, domain, auth) — don't wait for session end. Append an entry to docs/SESSIONS.md at the end of every working session. (This system exists because on 2026-07-14 a session wrote hours of content to the wrong Supabase project — the move was documented nowhere.)

## What this is

Magnify is the stake callings workflow app for stake/ward leadership of The Church of Jesus Christ of Latter-day Saints — kanban boards that move a calling from idea through approval, extend, sustain, and set apart. It is a PWA (with native iOS/Android builds via EAS) and part of the Gathered suite (Magnify, Glean, Tidings, Steward, Conduct, Liken). Lane: Church — member names and pastoral details are confidential and must never appear in code, docs, commits, or logs.

## Infrastructure — VERIFY BEFORE ANY DB WRITE

- **Supabase:** SHARED project `isogetmvnpimcmouakeg` (verified in `.env`). SHARED project — schema/auth changes affect Magnify/Glean/Knit/Liken/Conduct/Duty and more. Confirm the ref before every DB write. Also: the shared project's secret namespace is project-wide — grep other app dirs for `Deno.env.get('NAME')` before `supabase secrets set` (a cross-app VAPID overwrite broke push on 2026-05-20).
- **Table prefix: NONE.** Magnify is the original app on the shared project — its tables are unprefixed (`callings`, `wards`, `profiles`, `high_council_members`, `calling_log`, `sp_members`, `hc_approvals`, …) except the `magnify_*` ones (`magnify_push_subscriptions`, `magnify_native_push_tokens`, and the dashboard's `magnify_items` / `magnify_workstreams` / `magnify_workstream_members` / `magnify_meetings` / `magnify_metrics` / `magnify_metric_defs`). **New tables get the `magnify_` prefix** — the unprefixed ones are legacy. Be extra careful: an unprefixed table name here can collide with anything.
- **Auth Site URL:** Magnify OWNS the shared project's Supabase auth Site URL. Other apps live in the Redirect URLs allow-list. Do NOT change the Site URL.
- **Vercel / domain:** magnify.gatheredin.app (old magnify-eta.vercel.app 301s there via vercel.json). Deploys on push to main; build is `npm run build:web` (Expo web export → `dist/`).
- **GitHub:** https://github.com/sendscott-del/magnify (origin, push to main).
- **Native:** EAS project `@leftfieldapps/magnify`; ASC app id 6778263386; expo-updates OTA for JS-only changes. `ios/` and `android/` prebuild dirs are gitignored.
- **Secrets:** env var NAMES only — `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_APP_URL` in `.env` (never committed). EAS Build needs the `EXPO_PUBLIC_*` vars passed explicitly or native builds white-screen.

## Architecture snapshot

- Expo SDK 55 / React Native 0.83 / React 19, React Navigation, react-native-paper. Single codebase exports to web (PWA) and native.
- Supabase Auth (shared users across the suite; `user_apps` gates per-app access, Gather hub at gather.gatheredin.app manages access).
- Key dirs: `screens/`, `components/`, `context/`, `lib/`, `navigation/`, `store/`, `constants/` (incl. `changelog.ts`), `supabase/` (numbered SQL migrations + `functions/`).
- Push: pg_net trigger → Supabase Edge Function → Web Push → `setAppBadge()`.
- **Dashboard (v2.44.0) is the app's home and tab one**; Completed moved under Settings. `screens/main/Dashboard*`, `components/dashboard/`, `lib/dashboard*.ts`, one shared fetch in `context/DashboardContext.tsx`. Data rule: **the dashboard owns only what had no home** — `magnify_items` (one kind-discriminated spine for every obligation), workstreams and metrics are its own; callings, quarterly interviews and standard work are READ LIVE from `callings` / `steward_interviews` / `steward_behaviors` and never copied.
- Multi-tenant: **fully applied and live.** Stage 1 (tenant foundation) 2026-07-06; Stage 2 (`stake_id` + RLS re-key) applied 2026-07-09 along with invite codes and delegated per-stake approval. Magnify serves multiple stakes with database-enforced isolation.

## Rules for this repo

- Version lives in `package.json` (currently 2.51.x line); every user-facing change bumps it and appends `constants/changelog.ts` (the build runs `scripts/generate-changelog.js`).
- Deploy = push to GitHub main → Vercel builds. Scott tests on Vercel, not local — push after every change. Native JS changes ship via expo-updates OTA; binary changes need EAS build + store submit.
- Session docs: append `docs/SESSIONS.md` every session; update this file the moment an infra fact changes.
- SQL changes go in `supabase/` as numbered migration files.
- No secrets in committed files. No member names in fixtures, tests, or docs.

## Delivery surfaces (verify EVERY one per release — see global tech-stack.md rule)

| Surface | How it updates | Timeline | Verify by |
|---|---|---|---|
| Web (magnify.gatheredin.app) | Vercel on git push | ~2 min | load site / grep deployed bundle |
| Installed PWA (iOS/Android home screen) | same Vercel deploy; SW refresh on next open | minutes | reload twice |
| iOS App Store (v1.1.0 = build 16; older installs stranded on runtime 1.0.0) | `eas update` OTA, channel `production`, runtime PINNED `1.1.0` — or run the **Publish OTA update** GitHub Action (no laptop needed) | applies on the SECOND full launch | curl u.expo.dev with the live build's runtime+channel headers; check in-app Release Notes version |
| Android | NO Play presence — website serves the PWA | n/a | n/a |

- **OTA runtime is PINNED to `1.1.0`** (app.json — moved from 1.0.0 when build 15/16 shipped 2026-08-08; devices still on the old build sit on runtime 1.0.0 and receive NO updates) so every store binary shares one channel while the store version moves. Consequence: JS published to this runtime must lazy-`require` any native module older binaries lack (expo-notifications already does). A native module that can't be guarded = deliberately bump the pin + publish to both runtimes during transition.
- **EAS auth:** token at `~/.config/gatheredin/expo-token` (`EXPO_TOKEN=$(cat ~/.config/gatheredin/expo-token)`), account `leftfieldapps`. OTA publishing silently stopped for 2 months in 2026 when a login lapsed — after every `eas update`, verify the manifest endpoint serves it.
- **`eas update` env-inlining trap (found 2026-08-08, the root cause of the two-month stale fleet):** `--environment production` pulls env from **EAS's server-side env store, NOT `.env` or the eas.json build block.** A publish without those vars exports a bundle with EMPTY `EXPO_PUBLIC_SUPABASE_URL` → the JS throws `supabaseUrl is required` at startup on device → expo-updates error recovery silently rolls back to the embedded bundle and BLACKLISTS that update (`failed_launch_count`), with no crash report and no visible error. Users just stay on the old version forever. The three `EXPO_PUBLIC_*` vars are now stored in the EAS "production" environment (`eas env:list --environment production`) — keep them in sync with `.env`. **Verify every OTA end-to-end**: publish → run the simulator replica (or any sim build) twice → check `.expo-internal/expo-v11.db` `updates` table shows the new row with `successful_launch_count ≥ 1, failed_launch_count = 0`, or eyeball a v-specific feature on screen. Serving ≠ applying.
- **ASC API:** keys in `~/.appstoreconnect/private_keys/` (424J7NT92Y = API, P4F5BY7BW2 = APNs); issuer `dff48c7f-f787-4bec-9f7c-def2559b6c58`, app `6778263386`.

## Gotchas

- **A dashboard RPC must check `is_demo_user()` ITSELF.** The cross-app reads (`magnify_dash_interviews`, `magnify_dash_my_standard_work`, `magnify_dash_set_standard_work`) are SECURITY DEFINER because Steward's RLS is self-only — which also means the RESTRICTIVE `demo_block_all` policies do NOT apply inside them. On 2026-08-31 the App Review demo account read the stake's real `steward_interviews` through one of these before the guard was added. Every RPC added later needs the same guard.
- **Steward period anchors: weekly = SUNDAY.** `magnify_week_start()` exists because Steward's date-fns uses `weekStartsOn: 0` while Postgres `date_trunc('week')` is Monday-anchored — substituting it makes the dashboard's "3 of 5 done" disagree with the Steward grid by a week.
- **`steward_interviews.stake_id` is filled by a trigger** (`steward_interviews_fill_stake`), not by its writers. The exec-sec agent writes that table via the service role with no `auth.uid()`; the trigger is what makes NOT NULL safe. Don't remove it.
- **Demo is an identity, not a toggle.** `isDemo` in `lib/useDashboardData.ts` honours `profile.is_demo` (the flag RLS reads) as well as the in-app switch, because the demo account can turn the switch off. Related: `refresh()` waits on `authLoading` and carries a `runId` token — `user` lands a tick before `profile`, and without the gate an in-flight real fetch resolves after `loadDemo()` and overwrites the fixtures.
- **The dashboard's callings tile derives its breakdown from whatever stages are actually present**, biggest four first, rather than a hardcoded list — the board gained `pending_interview` in v2.48.0 and a fixed list would have silently hidden it.
- **`profiles` is SHARED across apps and scoped by an `app` column. Every profiles query must filter `.eq('app', ...)`.** A cross-app data leak (Magnify↔Sparkle Pro) was fixed 2026-06-08; a pending-queue leak was fixed 2026-06-10. Signup tags `app=magnify`.
- **Multi-tenant Stage 2 IS applied to the live DB (2026-07-09):** every Magnify table carries NOT NULL `stake_id`, all RLS is same-stake via `current_user_stake()`, inserts default the stake via `current_user_stake_single()`. Profiles visibility is stake-scoped too (`user_in_my_stake()`).
- **Desktop web is FULL WIDTH (Scott's call, 2026-08-08).** The centered 900px column (v2.37.1) was reported as a bug and removed in `scripts/postbuild.js` — do not reintroduce a desktop max-width.
- **EAS runs fully non-interactively** with these env vars (no `eas login` needed): `EXPO_TOKEN` (account access token), plus for anything touching Apple credentials: `EXPO_ASC_API_KEY_PATH=~/.appstoreconnect/private_keys/AuthKey_424J7NT92Y.p8`, `EXPO_ASC_KEY_ID=424J7NT92Y`, `EXPO_ASC_ISSUER_ID=dff48c7f-f787-4bec-9f7c-def2559b6c58`, `EXPO_APPLE_TEAM_ID=QRNJ2264QJ`, `EXPO_APPLE_TEAM_TYPE=INDIVIDUAL`. Without the TEAM_ID it silently falls back to an interactive prompt and skips profile validation. `eas update` also needs `--environment production`.
- **iOS push required enabling PUSH_NOTIFICATIONS on the App ID** (bundle `com.magnify.stakes`, Apple id `3FP8KYDU94`) — it was IN_APP_PURCHASE only. Enabling it INVALIDATES existing provisioning profiles; the old profile had to be deleted at Apple before EAS would mint a push-capable one. APNs key **created 2026-08-08**: "Left Field Apps Push", Key ID `P4F5BY7BW2`, Sandbox & Production, Team Scoped (all topics — reusable by every Left Field app). Private key backed up at `~/.appstoreconnect/private_keys/AuthKey_P4F5BY7BW2.p8` (Apple deletes their copy after the single download — this is the only copy). Registered in EAS and assigned to Magnify. Apple has no API for APNs key creation — portal only, so a replacement needs the browser.
- **Native push:** the App Store/Play binaries use `expo-notifications` → Expo Push API (tokens in `magnify_native_push_tokens`); web/PWA uses Web Push (`magnify_push_subscriptions`). All expo-notifications imports are LAZY (`require` in try/catch) so one OTA bundle serves old binaries (runtimeVersion policy = appVersion, pinned 1.0.0) without crashing — keep it that way.
- Demo mode: "Try the demo" (v2.37.0) and the App Review account are locked to fixture data; demo-account RLS lockdown landed 2026-07-08. Don't loosen demo RLS.
- TS 5.7+ needs an explicit `Uint8Array`/BufferSource cast for the VAPID key (fixed 2026-05-17; it silently breaks builds).
- Android build needs the `patch-package` fix for foojay-resolver-convention (Gradle 9); don't remove `patches/`.
- `.env` holds the only local copy of the Supabase env values; the repo has no `.env.example`.
- **Slack webhook rows are named after the EVENT, not the channel** — verified against the workspace 2026-08-17. `sp_stage_change` → #stakepresidencycallings (also carries new-calling + suggestion posts, despite the "SP channel only" comment in `lib/slack.ts`), `hc_stage_change` → #highcouncilcallings, `rejection` → **#stake-presidency** (the presidency's own channel, not a callings channel), `sp_reminder` → #stake-presidency (seeded from the rejection webhook 2026-08-17). No webhook points at **#high-council** — the `hc_reminder` slot is empty and HC reminders fall back to #highcouncilcallings until someone creates an Incoming Webhook for #high-council in the Slack app config. Don't infer a channel from a row's name; check `channel_name` or the workspace.
