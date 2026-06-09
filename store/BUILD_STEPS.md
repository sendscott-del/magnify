# Magnify — build & submit to the stores (runbook)

Magnify is an Expo app, so it builds **real native** binaries via EAS — no wrapper. Run these from `~/magnify`.
Prereqs already done: `eas.json`, `app.json` (bundle id `com.magnify.stakes`, buildNumber/versionCode), Google service-acct key at `~/.config/gatheredin/play-service-account.json`, Apple ASC API key at `~/Downloads/AuthKey_424J7NT92Y.p8`.

## 1. Log in to Expo (one time)
```
npx eas-cli login            # create a free account at expo.dev if needed
npx eas-cli init             # links repo → writes extra.eas.projectId into app.json
```

## 2. Create the store app records (web — one time each)
- **App Store Connect** → Apps → + → New App: platform iOS, name "Magnify", bundle ID `com.magnify.stakes`, SKU `magnify`.
- **Google Play Console** → Create app: name "Magnify", default language, app (not game), free. (Google account must be finished first — Thursday.)
- Grab from App Store Connect → Users and Access → Integrations → **Issuer ID** (needed below). Key ID is `424J7NT92Y`.

## 3. Build
```
npx eas-cli build -p ios --profile production
npx eas-cli build -p android --profile production   # outputs an AAB
```
- iOS: when prompted for credentials, choose the **App Store Connect API key** path and point to `~/Downloads/AuthKey_424J7NT92Y.p8` (Key ID `424J7NT92Y`, plus the Issuer ID). EAS manages the signing cert/profile.
- Android: let EAS generate the upload keystore (Play App Signing).

## 4. Submit
```
npx eas-cli submit -p ios --profile production
npx eas-cli submit -p android --profile production --key ~/.config/gatheredin/play-service-account.json
```

## 5. Fill listing + compliance (from store/listing.md)
- Description, keywords, category, screenshots, **privacy URL** https://gatheredin.app/privacy, support URL https://gatheredin.app.
- Apple **App Privacy** labels + Google **Data safety** form (answers in store/listing.md).
- **Demo reviewer login** in review notes (create a seeded non-confidential account first).
- Submit for review (both stores).

## 6. Make Apple "Unlisted" (after it's submitted to review)
- **Account owner (Scott)** submits: https://developer.apple.com/contact/request/unlisted-app/
- Must be after the app is submitted to App Review (not before, not in beta). Once approved, distribution locks to Unlisted and Apple gives a shareable link.

## 7. Google
- Roll out to **Production** (obscure but installable via link). New-account note: may require a closed test first — watch the Console prompt.

## Result
Two shareable install links (Apple unlisted link + Play link) → add them to the app UI + the gatheredin.app hub.
