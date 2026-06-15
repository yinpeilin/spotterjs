# Android Companion 自动化指南

`@spotterjs/plugin-android` 通过 Spotter mobile companion app 的 WebSocket
协议控制 Android 设备。自动化命令不再走 ADB。

## 安装

```bash
npm install @spotterjs/plugin-android
```

## 配对

打开手机 companion app，确认 WebSocket URL 和配对码，然后在 TypeScript 侧配对：

```typescript
import { android } from "@spotterjs/plugin-android";

const phone = await android.pair({
  url: "ws://192.168.1.23:17341",
  code: "123456",
  clientId: "my-script",
});

console.log(phone.sessionToken);
```

后续可以复用 session token：

```typescript
const phone = await android.connect({
  url: "ws://192.168.1.23:17341",
  sessionToken: process.env.SPOTTERJS_ANDROID_SESSION_TOKEN!,
});
```

## 从电脑端控制多台设备

一台电脑可以同时连接多台运行 companion app 的 Android 设备。推荐把每台设备的
WebSocket URL 和 session token 放到配置里，由脚本统一调度。

```typescript
import { android } from "@spotterjs/plugin-android";

const devices = [
  {
    name: "pixel-lab",
    url: "ws://192.168.1.23:17341",
    sessionToken: process.env.PIXEL_SESSION_TOKEN!,
  },
  {
    name: "samsung-lab",
    url: "ws://192.168.1.24:17341",
    sessionToken: process.env.SAMSUNG_SESSION_TOKEN!,
  },
];

const phones = await Promise.all(
  devices.map(async (item) => ({
    name: item.name,
    phone: await android.connect({
      url: item.url,
      sessionToken: item.sessionToken,
    }),
  }))
);

try {
  await Promise.all(
    phones.map(async ({ name, phone }) => {
      await phone.launchApp("com.android.settings");
      const display = await phone.getDisplayInfo();
      console.log(name, display.width, display.height);
    })
  );
} finally {
  for (const { phone } of phones) phone.close();
}
```

适合并行的任务包括启动同一个 App、读取当前界面、截图留档、等待某个文字出现。
会修改共享账号、后端状态或同一份测试数据的任务，建议按设备串行执行，避免互相影响。

## 设备操作

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

坐标使用 Android 设备屏幕坐标。

## 错误处理

`@spotterjs/plugin-android` 重新导出 `SpotterError`、`isSpotterError` 和
`toSpotterError`。Companion 错误使用 `SPOTTER_ANDROID_*` code 和
`domain: "android"`。

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

手机端返回业务错误 code 时，对外 code 固定为
`SPOTTER_ANDROID_COMPANION_ERROR`，设备返回的原始值放在
`context.remoteCode`。

## 无障碍树

```typescript
const tree = await phone.dumpTree({ maxDepth: 6 });
console.log(tree.children.length);
```

companion app 会序列化 Android accessibility 节点，包括 text、resource ID、
class name、package name、content description、bounds、center、状态标记、
depth、path 和 children。

## MCP 中使用

在 MCP Server 中启用 Android 工具：

```json
{
  "env": {
    "SPOTTERJS_ANDROID": "1"
  }
}
```

使用 `android_connect` 传 `{ "url": "...", "code": "..." }` 完成配对，或传
`{ "url": "...", "sessionToken": "..." }` 复用已有 session。

`android_connect` 会返回 `deviceId`，默认是 `"default"`。后续工具可以只传
`{ "deviceId": "default" }`，也可以继续使用旧式 `{ "url": "...", "sessionToken": "..." }`。

多设备时，为每台设备显式指定 `deviceId`：

```json
{
  "deviceId": "pixel-lab",
  "url": "ws://192.168.1.23:17341",
  "code": "123456"
}
```

```json
{
  "deviceId": "samsung-lab",
  "url": "ws://192.168.1.24:17341",
  "sessionToken": "saved-session-token"
}
```

后续调用只需要传对应的 `deviceId`。`android_list_devices` 可以列出 MCP
server 当前缓存的设备；`android_disconnect` 可以关闭某台设备的连接。

典型 MCP 闭环：

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

工具列表和请求形状见 [MCP Server](../MCP.md)。

## Smoke 测试

```powershell
$env:SPOTTERJS_ANDROID_URL = "ws://192.168.1.23:17341"
$env:SPOTTERJS_ANDROID_CODE = "123456"
npm run smoke:android
```

如果要复用 token，设置 `SPOTTERJS_ANDROID_SESSION_TOKEN`。

可选执行启动和元素等待演示：

```powershell
$env:SPOTTERJS_ANDROID_LAUNCH_PACKAGE = "com.android.settings"
$env:SPOTTERJS_ANDROID_WAIT_TEXT_CONTAINS = "Settings"
$env:SPOTTERJS_ANDROID_TAP_ELEMENT = "1"
npm run smoke:android
```

## 截图和模板匹配

先在 app 的权限面板中授权屏幕截图，再调用视觉 MCP 工具。companion 会通过已配对
WebSocket 返回 PNG 帧；MCP server 会写入 `.spotter/artifacts`，并返回
`coordinateSpace: "android-device"`。

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

`android_find_template_and_tap` 使用同一套模板字段，只会在匹配成功后点击。Android 14
及更新版本要求 MediaProjection 运行在 `mediaProjection` foreground service 中；
app 已声明该 service type，但仍需要用户授权当前截图 session。
