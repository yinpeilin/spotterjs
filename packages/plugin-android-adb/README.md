# @spotterjs/plugin-android-adb

Android automation plugin for SpotterJS using ADB only.

```ts
import { android } from "@spotterjs/plugin-android-adb";

const devices = await android.listDevices();
const phone = await android.connect({ serial: devices[0].serial });

await phone.tap(320, 900);
await phone.swipe({ x: 500, y: 1600 }, { x: 500, y: 500 });
await phone.text("hello");
await phone.keyevent("BACK");

const match = await phone.find("./button.png", { confidence: 0.9 });
await phone.tap(match.center.x, match.center.y);
```

`adb` must be installed and available on `PATH`, or pass `adbPath`.
For network devices, run `android.connectTcp("host:port")`; all later
operations use the returned serial.

Text input uses `adb shell input text`, which is limited by Android's input
command. Complex IME text, emoji, and some non-ASCII input may require a
dedicated IME/clipboard strategy in a later version.
