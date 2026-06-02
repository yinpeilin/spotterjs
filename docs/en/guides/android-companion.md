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
await phone.text("hello");
await phone.keyevent("BACK");
await phone.home();
```

Coordinates use Android device screen coordinates.

## Accessibility Tree

```typescript
const tree = await phone.dumpTree({ maxDepth: 6 });
console.log(tree.children.length);
```

The companion app serializes Android accessibility nodes with text, resource
ID, class name, package name, content description, bounds, center, state flags,
depth, path, and children.

## MCP Usage

Enable Android tools in the MCP server:

```json
{
  "env": {
    "SPOTTERJS_ANDROID": "1"
  }
}
```

Use `android_connect` with `{ "url": "...", "code": "..." }` to pair, or with
`{ "url": "...", "sessionToken": "..." }` to reuse an existing session.

`android_connect` returns a `deviceId` (`"default"` unless provided). Later
tools can pass only `{ "deviceId": "default" }`, while the old
`{ "url": "...", "sessionToken": "..." }` shape remains supported.

Typical MCP loop:

```json
{ "url": "ws://192.168.1.23:17341", "code": "123456" }
```

```json
{ "deviceId": "default", "packageName": "com.android.settings" }
```

```json
{
  "deviceId": "default",
  "textContains": "Settings",
  "waitTimeoutMs": 5000,
  "pollMs": 250,
  "maxDepth": 8
}
```

Tool names and request shapes are documented in [MCP server](../MCP.md).

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

## Current Limits

Screen capture and template matching are not implemented until the companion
app provides a frame capture protocol. MCP tools for these paths return explicit
errors instead of falling back to ADB.
