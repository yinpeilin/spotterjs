# Spotter Mobile Companion

Flutter Android companion app for pairing a phone with a Spotter desktop or MCP
bridge. The app is the phone-side software path for Android automation commands.

## China Mirror Setup

From the repository root:

```powershell
.\scripts\setup-mobile-companion.ps1 -InstallJdk -InstallPlatformTools
```

The helper configures the current PowerShell session with:

```powershell
$env:PUB_HOSTED_URL = "https://pub.flutter-io.cn"
$env:FLUTTER_STORAGE_BASE_URL = "https://storage.flutter-io.cn"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"
```

It clones Flutter from the Gitee mirror into
`$env:USERPROFILE\.spotter-tools\flutter`. The Android Gradle project also
declares Aliyun Maven mirrors before `google()` and `mavenCentral()`.

If `platform-tools` is missing, install Android SDK command line tools and run:

```powershell
sdkmanager --sdk_root=$env:LOCALAPPDATA\Android\Sdk --install platform-tools
```

## Development Commands

```powershell
cd apps\mobile-companion
flutter pub get
flutter test
flutter build apk --debug
```

Debug APKs are intentionally large because they include debug Dart assets,
validation layers, and multiple native libraries for development.

Use the release path for per-ABI APK distribution:

```powershell
.\scripts\setup-mobile-companion.ps1 -ConfigureOnly -PrintBuildCommands
cd apps\mobile-companion
flutter clean
flutter pub get
flutter build apk --release --split-per-abi
Get-ChildItem .\build\app\outputs\flutter-apk\app-*-release.apk |
  Select-Object Name,@{Name="MB";Expression={[math]::Round($_.Length / 1MB, 2)}}
```

The release build enables R8/resource shrinking in the Android Gradle project
and splits native libraries by ABI so each device only gets one matching APK.
That keeps the packages smaller than a universal APK.

To inspect an APK for debug-only payloads:

```powershell
jar tf .\build\app\outputs\flutter-apk\app-release.apk |
  Select-String "kernel_blob.bin|libVkLayer_khronos_validation"
```

## Pairing Protocol

Connect to the phone WebSocket address shown in the app.
The six digit pairing code stays valid until the user taps `Code` in the app
to rotate it. It does not expire on a timer.

Pair:

```json
{
  "type": "pair",
  "protocolVersion": 2,
  "clientId": "desktop-dev",
  "code": "123456"
}
```

Success:

```json
{
  "type": "paired",
  "protocolVersion": 2,
  "sessionToken": "<token>",
  "state": {
    "capabilities": {
      "screenCapture": false,
      "accessibilityTree": false,
      "accessibilityActions": false,
      "imeText": false,
      "notifications": false,
      "displayInfo": true,
      "currentApp": true
    }
  }
}
```

Later `heartbeat` and `status` messages must include the returned
`sessionToken`.

Launch an app by package name:

```json
{
  "type": "launchApp",
  "sessionToken": "<token>",
  "packageName": "com.android.settings"
}
```

Multi-touch gesture:

```json
{
  "type": "gesture",
  "sessionToken": "<token>",
  "strokes": [
    {
      "points": [{ "x": 120, "y": 800 }, { "x": 120, "y": 500 }],
      "durationMs": 300
    },
    {
      "points": [{ "x": 360, "y": 800 }, { "x": 360, "y": 500 }],
      "durationMs": 300
    }
  ]
}
```

Capture the current screen after the user grants the screen capture permission:

```json
{
  "type": "captureScreen",
  "sessionToken": "<token>"
}
```

Success returns a PNG frame as base64:

```json
{
  "type": "screenCaptured",
  "mimeType": "image/png",
  "width": 1080,
  "height": 2400,
  "density": 420,
  "base64": "<png>"
}
```

The `imeText` capability prefers the bundled `Spotter Keyboard` input method.
When the user enables and selects that keyboard in Android settings, text
commands are delivered through `InputConnection.commitText`. If the keyboard is
not selected, the app falls back to the accessibility service and calls
`ACTION_SET_TEXT` on the focused input node.

## Android Permissions

The app declares the Android services needed by the companion protocol:

- `MobileCompanionService`: foreground service used to keep the local pairing endpoint alive.
- `ScreenCaptureService`: MediaProjection foreground service used for PNG frame capture.
- `SpotterAccessibilityService`: accessibility service for UI tree and gesture actions.
- `SpotterInputMethodService`: optional Android keyboard used for robust text input.
- `MediaProjection` permission request: launched from the Flutter permission panel and required before `captureScreen`.

Android 14 and newer require the screen capture service to declare the
`mediaProjection` foreground service type. The app still needs a user-approved
MediaProjection session before it can return frames.
