# @spotterjs/plugin-android-adb

Android automation plugin for SpotterJS using ADB only.

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

`adb` must be installed and available on `PATH`, installed in a common Android
SDK platform-tools location, set with `SPOTTERJS_ADB_PATH`, or passed as
`adbPath`.

## UIAutomator Elements

The plugin can dump Android's built-in UIAutomator hierarchy and act on
semantic elements. Bounds and centers use Android device screen coordinates.

```typescript
const tree = await phone.dumpTree();
console.log(tree.children.map((node) => node.text));

const login = await phone.findElement({
  resourceId: "com.example:id/login",
  clickable: true,
});
await phone.tapElement(login);

await phone.typeElement(
  { classNameContains: "EditText", textContains: "Search" },
  "hello"
);

const done = await phone.waitForElement({ text: "Done" }, 5_000);
await phone.tap(done.center.x, done.center.y);
```

Supported element query fields: `text`, `textContains`, `resourceId`,
`resourceIdContains`, `className`, `classNameContains`, `contentDescription`,
`contentDescriptionContains`, `packageName`, `clickable`, `enabled`, `checked`,
`selected`, `scrollable`, and `focusable`.

## API

- `android.discover(options?)`: discover devices from `adb devices -l`.
- `android.connect({ serial, adbPath?, timeoutMs? })`: create an `AndroidDevice`.
- `android.connectDefault(options?)`: connect the only authorized device.
- `android.connectAll(options?)`: connect all authorized devices.
- `android.pairTcp({ host, port, code, adbPath?, timeoutMs? })`: run `adb pair`.
- `android.connectNetwork({ host, port, adbPath?, timeoutMs? })`: run `adb connect`.
- `AndroidDevice`: `capture`, `tap`, `swipe`, `text`, `keyevent`, `back`,
  `home`, `startApp`, `stopApp`, `find`, `findAll`, `waitFor`, `dumpTree`,
  `findElement`, `findElements`, `waitForElement`, `tapElement`, `typeElement`,
  `shell`, `getDisplayInfo`, `wake`, `sleep`, `currentApp`, and `clearApp`.
- `AndroidDeviceGroup`: `tapAll`, `swipeAll`, and `captureAll`.
- `AdbError`: thrown for ADB failures with a stable `code` and optional `stderr`.

Complex connection flows, multi-device usage, wireless debugging, and
troubleshooting are covered in [Android ADB automation](../../docs/guides/android-adb.md).

## Limits

Text input uses `adb shell input text`, which is limited by Android's input
command. Complex IME text, emoji, and some non-ASCII input may require a
dedicated IME or clipboard strategy in a later version.

## License

Learning and non-commercial use are free. Commercial use requires authorization.
See [LICENSE](../../LICENSE).
