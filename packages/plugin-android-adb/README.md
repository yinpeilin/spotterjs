# @spotterjs/plugin-android-adb

[中文文档](../../docs/zh-CN/guides/android-adb.md)

Android automation plugin for spotterjs using ADB only. It supports device
discovery, USB and wireless connections, capture, touch input, text input, app
control, UIAutomator element queries, template matching, and multi-device
helpers.

## Install

```bash
npm install @spotterjs/plugin-android-adb @spotterjs/core
```

## Quick Start

```typescript
import { android } from "@spotterjs/plugin-android-adb";

const phone = await android.connectDefault();

await phone.tap(320, 900);
await phone.swipe({ x: 500, y: 1600 }, { x: 500, y: 500 });
await phone.text("hello");
await phone.keyevent("BACK");

const match = await phone.find("./button.png", { confidence: 0.9 });
await phone.tap(match.center.x, match.center.y);
```

ADB must be available on `PATH`, installed in a common Android SDK
platform-tools location, configured with `SPOTTERJS_ADB_PATH`, or passed as
`adbPath`.

## UIAutomator Elements

```typescript
const login = await phone.findElement({
  resourceId: "com.example:id/login",
  clickable: true,
});

await phone.tapElement(login);
await phone.typeElement({ classNameContains: "EditText" }, "hello");
```

Element bounds and template matches use Android device screen coordinates.

## API

- `android.discover(options?)`: discover devices from `adb devices -l`.
- `android.connect({ serial, adbPath?, timeoutMs? })`: create an `AndroidDevice`.
- `android.connectDefault(options?)`: connect the only authorized device.
- `android.connectAll(options?)`: connect all authorized devices.
- `android.pairTcp({ host, port, code, adbPath?, timeoutMs? })`: run `adb pair`.
- `android.connectNetwork({ host, port, adbPath?, timeoutMs? })`: run `adb connect`.
- `AndroidDevice`: capture, tap, swipe, text, keyevent, app, UIAutomator, shell,
  display, template matching, and wait helpers.
- `AndroidDeviceGroup`: batch tap, swipe, and capture.
- `AdbError`: ADB failure with a stable `code` and optional `stderr`.

Complex connection flows, multi-device usage, wireless debugging, and
troubleshooting are covered in [Android ADB automation](../../docs/en/guides/android-adb.md).

## Limits

Text input uses `adb shell input text`, which is limited by Android's input
command. Complex IME text, emoji, and some non-ASCII input may require a
dedicated IME or clipboard strategy in a later version.

## License

Learning and non-commercial use are free. Commercial use requires
authorization. See [LICENSE](../../LICENSE).
