# Magnify — App Store / Play listing (draft for Scott's review)

Status: DRAFT. Nothing submitted. Fill the `[ ]` items and tweak copy before submission.
Distribution: **Apple = Unlisted** (not searchable), **Google = Production/obscure**. Free. No in-app purchases.

## Identity
- **App name:** Magnify
- **Subtitle (Apple, ≤30 chars):** Stake & ward calling workflow
- **Short description (Google, ≤80 chars):** Organize callings, sustainings, and setting-aparts for your stake and wards.
- **Bundle ID / package:** `com.magnify.stakes` (set in app.json)
- **Category:** Productivity (alt: Lifestyle)
- **Content rating:** 4+ / Everyone
- **Price:** Free

## Description (both stores)
Magnify helps stake and ward leaders manage the lifecycle of a calling — from proposal through interview, extension, sustaining, and setting apart — in one organized place. Built for the people who coordinate this work, it keeps each calling's status, history, and next step clear so nothing falls through the cracks.

Features:
- Track callings by stage across stake and ward organizations
- See what's pending your action at a glance
- Record interviews, sustainings, and setting-aparts
- Works on your phone and the web — your data stays in sync

Access is by invitation from your leaders. Magnify is a free, independent tool.

Magnify is not an official product of, and is not endorsed by, The Church of Jesus Christ of Latter-day Saints.

## Keywords (Apple, ≤100 chars, comma-sep)
callings,stake,ward,leadership,ministering,church,clerk,presidency,setting apart,sustaining

## URLs
- **Support URL:** https://gatheredin.app  (Contact: support@gatheredin.app — ⚠️ email forwarding TBD)
- **Privacy policy URL:** https://gatheredin.app/privacy
- **Marketing URL (optional):** https://magnify.gatheredin.app

## Reviewer access (REQUIRED — Apple & Google reviewers must log in)
- [ ] Create a demo account with seeded, non-confidential sample data (NOT real member data).
- [ ] Demo email + password → put in App Review notes / Play "app access" instructions.
- Note for reviewer: "This app requires an account; access is normally granted by a leader invitation. Use the demo credentials above."

## Apple — App Privacy ("nutrition label") answers
Data collected and **linked to identity**, used for **App Functionality** only (no tracking, no ads):
- Contact Info → **Name**, **Email Address**
- User Content → calling/assignment records the user enters
- Identifiers → user account ID
Not collected: location, financial info, health, browsing history, contacts, payments.
Tracking: **No**.

## Google — Data safety form answers
- Collects: Personal info (name, email), App activity / user-entered content. Account required.
- Shared with third parties: **No** (service providers like Supabase/Vercel process on our behalf; not "sharing" in the form's sense).
- Encrypted in transit: **Yes**.
- Users can request data deletion: **Yes** — via support@gatheredin.app (also link the privacy policy).
- Data collection optional?: No (an account is required to use the app).

## Assets still needed
- [ ] App icon 1024×1024 (have `assets/icon.png` — confirm size/no alpha for iOS)
- [ ] iPhone 6.7" screenshots (and 6.5" if required); iPad screenshots (app supportsTablet=true)
- [ ] Android phone screenshots (+ 7"/10" tablet), feature graphic 1024×500
- [ ] Build via `npx eas-cli build` then `eas submit` (needs eas login + accounts)
