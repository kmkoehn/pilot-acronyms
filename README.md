# Pilot Acronyms

Study app for private pilot students. The content and interface live in one page, which is published on the web and wrapped into Android and iPhone apps with Capacitor.

## Where things are

| Path | What it is |
|---|---|
| `pilot-acronyms.html` | The source for everything: content, styling, and behavior |
| `../Pilot-Acronyms.apk` | The latest Android build, written outside the repository |
| `assets/icon-source.webp` | The original icon artwork |
| `scripts/build-www.mjs` | Builds `www/` and `privacy-policy.html` from the page, with fonts bundled for offline use |
| `scripts/build-icon.mjs` | Builds every Android and iPhone icon, the iPhone launch screen, the store icon, and the logo in the page's header |
| `scripts/build-apk.mjs` | Runs the web build, syncs to Android, and builds the APK |
| `store/icon-512.png` | The Google Play icon |
| `privacy-policy.html` | The public privacy policy page, generated from the page |
| `android/` | The Android project |
| `ios/` | The iPhone project, built in the cloud by Codemagic |
| `codemagic.yaml` | The Codemagic build workflows |

`www/` and everything under `android/**/build` are generated, so don't edit them by hand.

## Common jobs

To change the content, edit `pilot-acronyms.html`, raise `versionCode` and `versionName` in `android/app/build.gradle`, then run:

```bash
npm run apk
```

To change the icon, replace `assets/icon-source.webp`, update the crop measurements at the top of `scripts/build-icon.mjs`, then run:

```bash
npm run icons
```

Republish the web chart after any change to the page.

## iPhone builds

iPhone apps can only be built on a Mac, so Codemagic builds them from this repository. Run `npx cap sync ios` after changing the page or icons, and commit the result. The iPhone version number comes from `package.json`.

- **iOS simulator preview** builds the app for the iOS simulator and saves light and dark screenshots. It needs no Apple account.
- **iOS TestFlight** signs the app and uploads it to TestFlight. Before it can run:
  1. Join the Apple Developer Program.
  2. Register the bundle ID `com.kmkoehn.pilotacronyms` and create the app in App Store Connect.
  3. Create an App Store Connect API key with the App Manager role, and add it in Codemagic under Developer Portal > Manage keys with the name `Pilot Acronyms` (the name `codemagic.yaml` uses).
  4. In Codemagic's Code signing identities, generate an Apple Distribution certificate with that key.
  5. In the Apple Developer portal, create an App Store Connect provisioning profile for the bundle ID using that certificate, then fetch it in Codemagic's Code signing identities.

## Sources

Rules and references were last checked against these editions on November 4, 2026:

- Aeronautical Information Manual, effective July 9, 2026 (Change 3)
- Private Pilot ACS, FAA-S-ACS-6C
- Pilot's Handbook of Aeronautical Knowledge, FAA-H-8083-25C
- Airplane Flying Handbook, FAA-H-8083-3C
- Aviation Weather Handbook, FAA-H-8083-28, listed by the FAA with an April 2, 2026 date

The sectional chart symbols card still needs a check against the current Aeronautical Chart Users' Guide, except the Class D line and the Class E 700 ft and 1,200 ft edges, which match AIM 3-2. Fuel colors, standard weights, CG effects, and load factor limits came from secondary sources and need a check against the PHAK and the Weight and Balance Handbook.
