# Android Companion Automation Guide

[Chinese documentation](../../zh-CN/guides/android-companion.md)

`@spotterjs/plugin-android` controls Android devices through the Spotter mobile
companion app over WebSocket. Automation commands do not use ADB.

## Install

```bash
npm install @spotterjs/plugin-android
```

## Pairing

Open the mobile companion app, confirm the WebSocket URL and pairing code, then
pair from TypeScript:

```typescript
import { android } from "@spotterjs/plugin-android";

const phone = await android.pair({
  url: "ws://192.168.1.23:17341",
  code: "123456",
  clientId: "my-script",
});

console.log(phone.sessionToken);
```

Reuse the returned session token for later commands:

```typescript
const phone = await android.connect({
  url: "ws://192.168.1.23:17341",
  sessionToken: process.env.SPOTTERJS_ANDROID_SESSION_TOKEN!,
});
```

## Device Actions

```typescript
await phone.heartbeat();
console.log(await phone.status());
console.log(await phone.getDisplayInfo());
console.log(await phone.currentApp());

await phone.launchApp("com.android.settings");
await phone.tap(320, 900);
await phone.swipe({ x: 500, y: 1600 }, { x: 500, y: 500 }, { durationMs: 350 });
await phone.gesture([
  {
    points: [
      { x: 240, y: 1200 },
      { x: 640, y: 1200 },
      { x: 640, y: 900 },
    ],
    durationMs: 450,
  },
]);
await phone.text("hello");
await phone.keyevent("BACK");
await phone.home();
```

Coordinates use Android device screen coordinates.

## Error Handling

`@spotterjs/plugin-android` re-exports `SpotterError`, `isSpotterError`, and
`toSpotterError`. Companion failures use `SPOTTER_ANDROID_*` codes and
`domain: "android"`.

```typescript
import { android, isSpotterError } from "@spotterjs/plugin-android";

try {
  await android.pair({ url, code, timeoutMs: 5000 });
} catch (error) {
  if (isSpotterError(error) && error.code === "SPOTTER_ANDROID_COMPANION_TIMEOUT") {
    console.log(error.context);
  }
}
```

When the phone returns a business error code, the public code is
`SPOTTER_ANDROID_COMPANION_ERROR` and the device-provided value is stored in
`context.remoteCode`.

## Accessibility Tree

```typescript
const tree = await phone.dumpTree({ maxDepth: 6 });
console.log(tree.children.length);
```

The companion app serializes Android accessibility nodes with text, resource
ID, class name, package name, content description, bounds, center, state flags,
depth, path, and children.

## CLI usage

Enable Android commands in the calling shell:

```powershell
$env:SPOTTERJS_ANDROID = '1'
spotterjs schema android_connect
spotterjs sequence --file phones.json
```

A plan keeps connect and follow-up commands in one process:

```json
[
  { "name": "android_connect", "arguments": { "deviceId": "phone-1", "url": "ws://192.168.1.23:17341", "code": "123456" } },
  { "name": "android_launch_app", "arguments": { "deviceId": "phone-1", "packageName": "com.android.settings" } },
  { "name": "android_current_app", "arguments": { "deviceId": "phone-1" } }
]
```

Use a distinct `deviceId` for each phone. `android_list_devices` lists only
connections cached by the current process; they close when it exits. Save the
returned session token securely for later reconnects. Independent CLI invocations
must pass `url` and `sessionToken` on each Android action. Within a sequence,
follow-up commands can use just the cached `deviceId`.

See [CLI + Skill](../CLI.md) and [Sequences](./sequences.md) for input files,
structured results, session lifetime, and failure behavior.

## Smoke Test

```powershell
$env:SPOTTERJS_ANDROID_URL = "ws://192.168.1.23:17341"
$env:SPOTTERJS_ANDROID_CODE = "123456"
npm run smoke:android
```

To reuse a token instead of pairing again, set
`SPOTTERJS_ANDROID_SESSION_TOKEN`.

Optionally run a launch and element-wait demo:

```powershell
$env:SPOTTERJS_ANDROID_LAUNCH_PACKAGE = "com.android.settings"
$env:SPOTTERJS_ANDROID_WAIT_TEXT_CONTAINS = "Settings"
$env:SPOTTERJS_ANDROID_TAP_ELEMENT = "1"
npm run smoke:android
```

## Screen Capture And Templates

Use the app permission panel to grant screen capture before calling visual CLI
commands. The companion sends captures as PNG frames over the paired WebSocket;
the CLI writes them to `.spotter/artifacts` and returns
`coordinateSpace: "android-device"`.

```json
{ "deviceId": "default", "detail": "original" }
```

```json
{
  "deviceId": "default",
  "image": { "path": "assets/android/button.png" },
  "confidence": 0.9,
  "debugImage": true
}
```

`android_find_template_and_tap` uses the same template fields and taps only
after a successful match. Android 14 and newer require the companion to run
MediaProjection through a `mediaProjection` foreground service; the app
declares that service type and still requires a fresh user-granted projection
session.
