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
```

## Device API

- `heartbeat()`
- `status()`
- `getDisplayInfo()`
- `currentApp()`
- `dumpTree({ maxDepth? })`
- `tap(x, y)`
- `swipe(from, to, { durationMs? })`
- `text(text)`
- `keyevent(key)`
- `back()`
- `home()`

Coordinates use the Android device screen coordinate space.

Screen capture and template matching are intentionally not exposed until the
companion app provides a frame capture protocol.
