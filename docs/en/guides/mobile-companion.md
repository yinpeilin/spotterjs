# Mobile Companion App

[Chinese documentation](../../zh-CN/guides/mobile-companion.md)

`apps/mobile-companion` is the Spotter Android companion app. It provides the
phone-side WebSocket pairing endpoint used by `@spotterjs/plugin-android` and
the CLI Android commands.

The app is not an npm workspace package and is not part of the Rust workspace.
Maintain it as a Flutter Android app under `apps/mobile-companion`.

## Environment Setup

On Windows, the helper script can configure China mirrors and print build
commands:

```powershell
.\scripts\setup-mobile-companion.ps1 -ConfigureOnly -PrintBuildCommands
```

To install the local helper Flutter SDK and optionally install JDK or Android
platform-tools:

```powershell
.\scripts\setup-mobile-companion.ps1 -InstallJdk -InstallPlatformTools
```

The helper uses `$env:USERPROFILE\.spotter-tools\flutter` by default. If you
already have Flutter installed, make sure `flutter` is available on `PATH`.

## Repository Commands

From the repository root:

```bash
npm run mobile:doctor
npm run mobile:check
npm run mobile:build:debug
npm run mobile:build:release
```

`mobile:check` runs `flutter analyze` and `flutter test`. The root scripts use
Flutter from `PATH`, or fall back to the helper SDK at
`$USERPROFILE\.spotter-tools\flutter` on Windows. Set `SPOTTERJS_FLUTTER_BIN` to
override the executable path.

When dependencies have already been resolved, avoid another pub resolution with:

```bash
node scripts/mobile-companion.mjs check --no-pub
```

Run `flutter pub get` inside the app once after a fresh checkout or dependency
change. The wrapper also supports `--no-pub` for analyze, test, and APK builds.

For direct Flutter commands:

```bash
cd apps/mobile-companion
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
flutter build apk --release --split-per-abi
```

## Pairing Protocol

The phone app shows a local WebSocket URL and a six digit pairing code. Desktop
clients first send:

```json
{
  "type": "pair",
  "protocolVersion": 2,
  "clientId": "desktop-dev",
  "code": "123456"
}
```

After pairing, the app returns a `sessionToken`. Later `heartbeat`, `status`,
input, accessibility, and app-launch commands must include that token.

The current protocol is also documented in
[Android companion automation](./android-companion.md).

## Capabilities And Permissions

The app exposes capabilities based on Android permission state:

- Accessibility service: accessibility tree, tap, swipe, multi-touch, Back/Home,
  and fallback text input.
- Spotter Keyboard: IME text input through `InputConnection.commitText`.
- Screen capture session: grants MediaProjection PNG capture through the paired
  WebSocket; Android 14+ requires the declared `mediaProjection` foreground service.
- Foreground service notification: keeps the pairing endpoint visible while it is
  running.

Users must enable the accessibility service and Spotter Keyboard in Android
settings. Screen capture still requires user confirmation.

## Release Notes

Debug APKs are for local development only. Release builds currently use split
ABI APKs:

```bash
npm run mobile:build:release
```

Before public distribution, replace the debug signing config in
`apps/mobile-companion/android/app/build.gradle.kts` with the project release
keystore policy. The current debug signing configuration is suitable only for
internal testing.
