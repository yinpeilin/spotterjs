# @spotterjs/plugin-android

Android companion app automation client for spotterjs.

This package connects to the Spotter mobile companion app over WebSocket. It
does not use ADB for automation commands.

## Install

```bash
npm install @spotterjs/plugin-android
```

## Pair And Connect

```typescript
import { android } from "@spotterjs/plugin-android";

const phone = await android.pair({
  url: "ws://192.168.1.23:17341",
  code: "123456",
  clientId: "my-script",
});

await phone.heartbeat();
console.log(phone.sessionToken);

const samePhone = await android.connect({
  url: "ws://192.168.1.23:17341",
  sessionToken: phone.sessionToken,
});

await samePhone.launchApp("com.android.settings");
const frame = await samePhone.captureScreen();
console.log(frame.width, frame.height);
```

## Device API

- `heartbeat()`
- `status()`
- `getDisplayInfo()`
- `currentApp()`
- `launchApp(packageName)`
- `captureScreen()`
- `dumpTree({ maxDepth? })`
- `tap(x, y)`
- `swipe(from, to, { durationMs? })`
- `gesture(strokes)`
- `text(text)`
- `keyevent(key)`
- `back()`
- `home()`

Coordinates use the Android device screen coordinate space.

Use `gesture(strokes)` for multi-point or multi-stroke touch input:

```typescript
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
```

`captureScreen()` returns PNG bytes plus width, height, and density. Template
matching stays in the MCP layer so the core plugin can remain transport-only.
