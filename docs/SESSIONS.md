# Magnify — session log

Append-only, newest first. Every working session adds one entry at the TOP: date, what changed, any infra facts touched (database, domain, auth, secrets). Infra changes also go into `CLAUDE.md` immediately, not just here.

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
