# Android ADB Automation Guide

[中文文档](../../zh-CN/guides/android-adb.md)

`@spotterjs/plugin-android-adb` controls Android devices through ADB. It
provides capture, tap, swipe, text input, key events, app start/stop,
UIAutomator element queries, template matching, and multi-device helpers.

## Install

```bash
npm install @spotterjs/plugin-android-adb @spotterjs/core
```

ADB lookup order:

1. Explicit `adbPath`.
2. `SPOTTERJS_ADB_PATH`.
3. `adb` on `PATH`.
4. Common Android SDK platform-tools locations.

## USB Connection

1. Enable Developer Options on the phone.
2. Enable USB debugging.
3. Connect the phone and accept the authorization prompt.
4. Discover or connect to the device.

```typescript
import { android } from "@spotterjs/plugin-android-adb";

const devices = await android.discover();
console.log(devices);

const phone = await android.connectDefault();
await phone.tap(320, 900);
```

`connectDefault()` succeeds only when exactly one authorized device is
available. Otherwise use `connect({ serial })`.

## Android 11+ Wireless Debugging

Wireless debugging has two ports: a pairing port and a connection port. They
are often different.

```typescript
await android.pairTcp({
  host: "192.168.1.23",
  port: 37155,
  code: "123456",
});

const phone = await android.connectNetwork({
  host: "192.168.1.23",
  port: 42173,
});
```

The pairing code and pairing port come from "Pair device with pairing code".
The connection port comes from the main Wireless debugging screen.

## Device Actions

```typescript
await phone.tap(320, 900);
await phone.swipe({ x: 500, y: 1600 }, { x: 500, y: 500 });
await phone.text("hello");
await phone.keyevent("BACK");
await phone.home();

await phone.startApp("com.example.app", ".MainActivity");
await phone.stopApp("com.example.app");
```

Text input uses `adb shell input text`. Complex IME text, emoji, and some
non-ASCII text may need a dedicated IME or clipboard strategy in a later
version.

## UIAutomator Elements

```typescript
const login = await phone.findElement({
  resourceId: "com.example:id/login",
  clickable: true,
});

await phone.tapElement(login);
await phone.typeElement({ classNameContains: "EditText" }, "hello");
```

Element bounds and centers use Android device screen coordinates.

## Capture and Template Matching

```typescript
const cap = await phone.capture();

const match = await phone.find("./button.png", {
  confidence: 0.9,
  scale: true,
});

await phone.tap(match.center.x, match.center.y);
```

Android matching results use the `android-device` coordinate space: the same
coordinates as the device screenshot.

## Multiple Devices

```typescript
const group = await android.connectAll();

await group.tapAll(320, 900);
await group.swipeAll({ x: 500, y: 1600 }, { x: 500, y: 500 });

const captures = await group.captureAll();
for (const item of captures) {
  console.log(item.serial, item.ok);
}
```

Multi-device helpers dispatch concurrently across authorized devices. Commands
for a single device remain serialized.

## MCP Usage

Enable Android tools in the MCP server:

```json
{
  "env": {
    "SPOTTERJS_ANDROID_ADB": "1"
  }
}
```

Tool names and request shapes are documented in [MCP server](../MCP.md).

## Troubleshooting

- `adb` not found: install Android SDK platform-tools or set `SPOTTERJS_ADB_PATH`.
- `unauthorized`: accept USB authorization on the device, then reconnect.
- Wireless debugging fails: verify that the pairing and connection ports are not mixed up.
- Multi-device safety: call `android.discover()` first and connect by serial when needed.
