# Magnify — session log

Append-only, newest first. Every working session adds one entry at the TOP: date, what changed, any infra facts touched (database, domain, auth, secrets). Infra changes also go into `CLAUDE.md` immediately, not just here.

## 2026-08-02 — v2.38.1: web/PWA safe-area regression — viewport-fit=cover (postbuild)

- Scott reported (with screenshots) the Gathered bar + content sliding under the iPhone status bar on the installed app. Root cause on web: Expo's web template emits a viewport meta WITHOUT `viewport-fit=cover`, so `env(safe-area-inset-top)` is 0 — and react-native-safe-area-context's web provider measures exactly that CSS value, so `insets.top` was 0 and the v2.31.1 `paddingTop: insets.top + 6` fix collapsed on web. Native was unaffected.
- Fix: `scripts/postbuild.js` now appends `viewport-fit=cover` to the generated viewport meta (guarded, idempotent). Verified locally by running postbuild against dist.
- Same session fixed the sibling bug in Conduct (v0.10.1) and Liken (v0.9.1): their switcher bars were missing the `env(safe-area-inset-top)` padding Steward added in `5db0290`. Glean/Knit/Tidings already had it.
- Pushed to main (`dad0145b`); Vercel rebuilds the web export.

- Web-only fix: on viewports ≥1024px the app rendered full-bleed edge-to-edge. Added step 5 to `scripts/postbuild.js` — injects a `<style id="desktop-layout">` block into the exported `dist/index.html` (`#root` max-width 900px + `margin: 0 auto`, body background `#f7f8fb`, all inside `@media (min-width: 1024px)`). Below 1024px and on native nothing changes (postbuild only touches the web export).
- Verified locally: `npm run build:web` succeeds, CSS present in dist, screenshots at 1280px (centered column) and 1000px (unchanged full-bleed).
- No infra touched. State: v2.37.1 pushed to main → Vercel deploy. Pre-existing uncommitted `app.json` versionCode bump left untouched.

## 2026-07-15 — Doc system initialized (history reconstructed from git)

- 2026-03-28: initial scaffold on the shared Supabase project — schema deliberately preserved Sparkle Pro's existing tables; Magnify's own tables are unprefixed.
- 2026-03-29 → 04-18: rapid v1.x→v2.x buildout — full EN/ES i18n, sustaining/release script generator, Slack webhooks per board, permissions overhaul, deep links.
- 2026-04-29 → 05-25: stake-suite design system adoption, new brand marks, Gathered 5-app switcher, Web Push home-screen badges (v2.16), web/desktop parity (Phase 6, v2.24–2.25).
- 2026-05-20: VAPID push secrets recovered after a cross-app overwrite in the shared secret namespace (#19) — origin of the "grep before `supabase secrets set`" rule.
- 2026-06-08: migrated to magnify.gatheredin.app; fixed Magnify↔Sparkle `profiles` leak by scoping the shared table with an `app` column; EAS build/submit pipeline set up (ASC 6778263386).
- 2026-06-09 → 06-15: expo-updates OTA added, Church disclaimer on sign-in, security hardening (v2.33), High Council roster management (v2.34–2.35), "Try the demo" one-tap Demo Mode (v2.37.0), Gradle 9 Android build patch.
- 2026-07-05 → 07-06: Gathered super-admin RLS for HC roster; multi-tenant Stage 1 tenant foundation (additive); /install.html PWA install page.
- 2026-07-08: demo account locked down from confidential church data (RLS); multi-tenant Stage 2 (`stake_id` + RLS re-key) committed but marked NOT YET APPLIED to the database.
- State at initialization: v2.37.0, 155 commits, live at magnify.gatheredin.app, working tree has one uncommitted `app.json` change (left untouched).
