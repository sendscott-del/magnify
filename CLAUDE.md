# Magnify — current state

> Read this before touching the app. Update it the MOMENT an infra fact changes (database, domain, auth) — don't wait for session end. Append an entry to docs/SESSIONS.md at the end of every working session. (This system exists because on 2026-07-14 a session wrote hours of content to the wrong Supabase project — the move was documented nowhere.)

## What this is

Magnify is the stake callings workflow app for stake/ward leadership of The Church of Jesus Christ of Latter-day Saints — kanban boards that move a calling from idea through approval, extend, sustain, and set apart. It is a PWA (with native iOS/Android builds via EAS) and part of the Gathered suite (Magnify, Glean, Tidings, Steward, Conduct, Liken). Lane: Church — member names and pastoral details are confidential and must never appear in code, docs, commits, or logs.

## Infrastructure — VERIFY BEFORE ANY DB WRITE

- **Supabase:** SHARED project `isogetmvnpimcmouakeg` (verified in `.env`). SHARED project — schema/auth changes affect Magnify/Glean/Knit/Liken/Conduct/Duty and more. Confirm the ref before every DB write. Also: the shared project's secret namespace is project-wide — grep other app dirs for `Deno.env.get('NAME')` before `supabase secrets set` (a cross-app VAPID overwrite broke push on 2026-05-20).
- **Table prefix: NONE.** Magnify is the original app on the shared project — its tables are unprefixed (`callings`, `wards`, `profiles`, `high_council_members`, `calling_log`, `sp_members`, `hc_approvals`, …) except `magnify_push_subscriptions`. Be extra careful: an unprefixed table name here can collide with anything.
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
- Multi-tenant work in flight: Stage 1 (tenant foundation) committed 2026-07-06; Stage 2 (`stake_id` + RLS re-key) committed 2026-07-08 but the migration is **NOT YET APPLIED** to the database.

## Rules for this repo

- Version lives in `package.json` (currently 2.37.x line); every user-facing change bumps it and appends `constants/changelog.ts` (the build runs `scripts/generate-changelog.js`).
- Deploy = push to GitHub main → Vercel builds. Scott tests on Vercel, not local — push after every change. Native JS changes ship via expo-updates OTA; binary changes need EAS build + store submit.
- Session docs: append `docs/SESSIONS.md` every session; update this file the moment an infra fact changes.
- SQL changes go in `supabase/` as numbered migration files.
- No secrets in committed files. No member names in fixtures, tests, or docs.

## Gotchas

- **`profiles` is SHARED across apps and scoped by an `app` column. Every profiles query must filter `.eq('app', ...)`.** A cross-app data leak (Magnify↔Sparkle Pro) was fixed 2026-06-08; a pending-queue leak was fixed 2026-06-10. Signup tags `app=magnify`.
- Stage 2 multi-tenant migration is committed but not applied — don't assume `stake_id` columns exist in the live DB.
- Demo mode: "Try the demo" (v2.37.0) and the App Review account are locked to fixture data; demo-account RLS lockdown landed 2026-07-08. Don't loosen demo RLS.
- TS 5.7+ needs an explicit `Uint8Array`/BufferSource cast for the VAPID key (fixed 2026-05-17; it silently breaks builds).
- Android build needs the `patch-package` fix for foojay-resolver-convention (Gradle 9); don't remove `patches/`.
- `.env` holds the only local copy of the Supabase env values; the repo has no `.env.example`.
