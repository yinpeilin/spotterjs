# Spotter Mobile Companion

Flutter Android companion app for pairing a phone with a Spotter desktop or MCP bridge.

The first milestone is the connection loop:

1. The phone shows a local WebSocket address and six digit pairing code.
2. The desktop sends a `pair` message with that code.
3. The phone returns a one-time `sessionToken`.
4. Later messages must include that token.

ADB remains the bootstrap and fallback path for install, debug, and privileged shell tasks.

## Local Setup

Windows mirror setup used on this machine:

```powershell
$env:PUB_HOSTED_URL = "https://pub.flutter-io.cn"
$env:FLUTTER_STORAGE_BASE_URL = "https://storage.flutter-io.cn"
$env:PATH = "$env:USERPROFILE\.spotter-tools\flutter\bin;$env:PATH"
```

Flutter SDK was cloned from:

```powershell
git clone --depth 1 -b stable https://gitee.com/mirrors/Flutter.git $env:USERPROFILE\.spotter-tools\flutter
```

From this directory:

```powershell
flutter pub get
flutter test
flutter build apk
```

Android builds also need JDK 17 and Android SDK/platform tools. The repository helper is:

```powershell
.\scripts\setup-mobile-companion.ps1 -InstallJdk -InstallPlatformTools
```

## Pairing Protocol

Connect to the phone WebSocket address shown in the app.

Pair:

```json
{
  "type": "pair",
  "protocolVersion": 1,
  "clientId": "desktop-dev",
  "code": "123456"
}
```

Success:

```json
{
  "type": "paired",
  "protocolVersion": 1,
  "sessionToken": "<token>",
  "state": {
    "capabilities": {
      "screenCapture": false,
      "accessibilityTree": false,
      "accessibilityActions": false,
      "imeText": false,
      "notifications": false,
      "adbBootstrap": true
    }
  }
}
```

Heartbeat:

```json
{
  "type": "heartbeat",
  "sessionToken": "<token>"
}
```

Status:

```json
{
  "type": "status",
  "sessionToken": "<token>"
}
```

## Android Permissions

The app declares the Android services needed for later milestones:

- `MobileCompanionService`: foreground service used to keep the local pairing endpoint alive.
- `SpotterAccessibilityService`: accessibility service stub for UI tree and gesture actions.
- `MediaProjection` permission request: launched from the Flutter permission panel.

The connection milestone does not yet expose screen frames or UI nodes over the protocol. Those should be added as explicit capability-backed commands after the bridge client exists.
