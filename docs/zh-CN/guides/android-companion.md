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

## 设备操作

```typescript
await phone.heartbeat();
console.log(await phone.status());
console.log(await phone.getDisplayInfo());
console.log(await phone.currentApp());

await phone.tap(320, 900);
await phone.swipe({ x: 500, y: 1600 }, { x: 500, y: 500 }, { durationMs: 350 });
await phone.text("hello");
await phone.keyevent("BACK");
await phone.home();
```

坐标使用 Android 设备屏幕坐标。

## Accessibility Tree

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

工具列表和请求形状见 [MCP Server](../MCP.md)。

## Smoke Test

```powershell
$env:SPOTTERJS_ANDROID_URL = "ws://192.168.1.23:17341"
$env:SPOTTERJS_ANDROID_CODE = "123456"
npm run smoke:android
```

如果要复用 token，设置 `SPOTTERJS_ANDROID_SESSION_TOKEN`。

## 当前限制

屏幕截图和模板匹配要等 companion app 提供帧捕获协议后再开放。MCP 对这些路径会返回明确的未实现错误，不会回退到 ADB。
