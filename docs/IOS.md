# Linicro: iOS build (Capacitor 8)

The web game is wrapped with **Capacitor 8.6** (Swift Package Manager, no
CocoaPods). The `ios/` Xcode project is **already generated and committed**
(`npx cap add ios` ran on Linux without Xcode, because SPM needs no
`pod install`). On a Mac you only build, sign and run.

| | |
|---|---|
| App ID / bundle id | `com.studiolinicro.linicro` |
| Display name | Linicro |
| Publisher | Studio Linicro |
| Subtitle / search | vintage phone games (not the product name) |
| Web dir | `dist` (Vite build) |
| iOS minimum | 15.0 |
| Devices | iPhone only (`TARGETED_DEVICE_FAMILY = 1`), portrait only |
| Plugins | app, filesystem, haptics, share, splash-screen, status-bar, local Game Center plugin |

## 0. One-time Mac setup

```bash
xcode-select --install                 # command line tools (if not installed)
# Xcode 16 or newer from the App Store, open it once and accept the licence
sudo xcodebuild -license accept
node -v                                # Node 20+ (22 LTS recommended)
```

## 1. Get the code and build the web app

```bash
git clone <your repo url> vintage-phone-games   # repository name; the app is Linicro
cd vintage-phone-games
npm ci                                 # exact versions from package-lock.json
npm run build                          # Vite -> dist/
```

## 2. iOS platform

The `ios/` folder is in git. **Do not** run `npx cap add ios` again unless you
deleted it. If you did delete it:

```bash
npx cap add ios                        # regenerates ios/ (SPM)
# then re-apply the project tweaks listed in section 7
```

## 3. App icon and splash (optional, already done)

`resources/icon.png` (1024x1024, opaque) and `resources/splash.png` /
`resources/splash-dark.png` (2732x2732) are original art drawn by
`scripts/make-resources.py`. They are already copied into
`ios/App/App/Assets.xcassets`. To regenerate every size properly:

```bash
python3 scripts/make-resources.py      # optional: redraw the PNGs
npx @capacitor/assets generate --ios   # writes AppIcon + Splash into the Xcode project
```

## 4. Sync web build + plugins into the Xcode project

Run this after **every** `npm run build` or plugin change:

```bash
npx cap sync ios                       # copies dist/ and updates CapApp-SPM/Package.swift
# shortcut: npm run cap:sync          (= npm run build && npx cap sync ios)
```

## 5. Open Xcode

```bash
npx cap open ios                       # opens ios/App/App.xcodeproj
```

Wait for "Resolving Package Graph" to finish (first time it downloads
`capacitor-swift-pm`).

## 6. Signing, capabilities, run

1. Select the **App** project > **App** target > **Signing & Capabilities**.
2. Tick **Automatically manage signing**, pick your **Team** (Studio Linicro's
   Apple Developer account). The bundle id is already
   `com.studiolinicro.linicro`; if Xcode says it is taken, register
   it at developer.apple.com > Identifiers first.
3. **+ Capability > Game Center**. The entitlements file
   `App/App.entitlements` is already wired (`CODE_SIGN_ENTITLEMENTS`).
4. General tab: check *Version* (MARKETING_VERSION, now 1.0) and *Build*
   (CURRENT_PROJECT_VERSION). Bump Build for every upload.
5. Plug in an iPhone (or pick a simulator). On the phone: Settings >
   Privacy & Security > **Developer Mode** on (iOS 16+), and trust the
   computer.
6. Press **Run** (Cmd+R). First run on a device: Settings > General > VPN &
   Device Management > trust your developer certificate.

Command-line alternative:

```bash
npx cap run ios                        # pick a device / simulator from the list
```

## 7. Project tweaks already applied (keep them if you regenerate ios/)

`ios/App/App/Info.plist`
- `UISupportedInterfaceOrientations` and `~ipad`: **only**
  `UIInterfaceOrientationPortrait` (portrait lock)
- `UIRequiresFullScreen` = YES
- `UIStatusBarHidden` = YES (the game draws its own status bar;
  `UIViewControllerBasedStatusBarAppearance` stays YES so the StatusBar
  plugin can hide it at runtime too)
- `UIRequiredDeviceCapabilities` = `arm64`
- `ITSAppUsesNonExemptEncryption` = NO (no custom crypto; skips the export
  compliance question on every upload)

`ios/App/App.xcodeproj/project.pbxproj`
- `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` (Debug and Release)
- `TARGETED_DEVICE_FAMILY = 1` (iPhone only; iPad would need iPad
  screenshots for review)

`capacitor.config.json`
- `ios.contentInset: "never"`, `scrollEnabled: false`, no link previews
- SplashScreen: 1.2 s, no spinner, dark background
- StatusBar: overlays the web view (hidden at launch by `src/native/Native.js`)

Web side (`index.html`)
- `viewport-fit=cover` and the phone sized inside `env(safe-area-inset-*)`
- no text selection, long-press callouts, tap highlight, pinch or double-tap zoom

## 8. Native behaviour map

| Feature | Web | iOS app |
|---|---|---|
| Share score card | Web Share / PNG download | PNG -> `@capacitor/filesystem` cache -> `@capacitor/share` sheet |
| Daily share text | Web Share / clipboard | share sheet (text rides with the card) |
| Haptics | `navigator.vibrate` (Android browsers) | `@capacitor/haptics` Taptic Engine |
| App to background | tab blur / visibilitychange | `@capacitor/app` pause -> same auto-pause, music stop, battery/wear save |
| Status bar | n/a | hidden |
| Back button | n/a | swallowed (no-op); the red C key is Back |
| Game Center | local bests screen | `plugins/capacitor-game-center` (see GAMECENTER.md) |

## 9. Ship to TestFlight / App Store

1. App Store Connect > My Apps > **+ New App**: iOS, name *Linicro*,
   bundle id `com.studiolinicro.linicro`, SKU of your choice.
   Publisher stays Studio Linicro. The product name is Linicro; use
   "vintage phone games" only as a subtitle or search keyword.
2. Game Center: create the leaderboards and achievements in
   `docs/GAMECENTER.md`.
3. Xcode: select **Any iOS Device (arm64)** > Product > **Archive** >
   Distribute App > App Store Connect > Upload.
4. TestFlight: add internal testers, test Game Center with a sandbox account.
5. App page: screenshots (6.9" and 6.5" iPhone), description, keywords,
   support URL, privacy policy URL, age rating, App Privacy ("Data Not
   Collected": the game keeps everything in local storage).
6. Submit for review.

## Troubleshooting

- *"No such module Capacitor"*: File > Packages > Reset Package Caches, then build again.
- *Blank white screen*: you forgot `npm run build && npx cap sync ios`.
- *Game Center sheet never shows*: the capability is missing, or the bundle
  id has no Game Center entry in App Store Connect yet.
