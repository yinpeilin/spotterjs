# Android ADB 自动化指南

`@spotterjs/plugin-android-adb` 通过 ADB 控制 Android 设备，提供截图、点击、滑动、文本输入、按键、应用启动停止和模板匹配能力。

## 安装

```bash
npm install @spotterjs/plugin-android-adb @spotterjs/core
```

`adb` 查找顺序：

1. 显式传入 `adbPath`。
2. 环境变量 `SPOTTERJS_ADB_PATH`。
3. `PATH` 中的 `adb`。
4. 常见 Android SDK platform-tools 路径。

## USB 连接

1. 在手机上启用开发者选项。
2. 启用 USB 调试。
3. 连接手机，并在设备上接受授权提示。
4. 使用发现或默认连接 API。

```typescript
import { android } from "@spotterjs/plugin-android-adb";

const devices = await android.discover();
console.log(devices);

const phone = await android.connectDefault();
await phone.tap(320, 900);
```

`connectDefault()` 只在恰好有一台 authorized 设备时成功。没有设备或存在多台设备时会抛错，并返回候选信息，调用方可以改用 `connect({ serial })`。

## Android 11+ 无线调试

无线调试有两个端口：配对端口和连接端口，二者经常不同。

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

配对信息来自手机的「使用配对码配对设备」页面；连接端口来自无线调试主页面。

## 设备操作

```typescript
await phone.tap(320, 900);
await phone.swipe({ x: 500, y: 1600 }, { x: 500, y: 500 });
await phone.text("hello");
await phone.keyevent("BACK");
await phone.home();

await phone.startApp("com.example.app", ".MainActivity");
await phone.stopApp("com.example.app");
```

文本输入使用 `adb shell input text`，对复杂 IME 文本、emoji 和部分非 ASCII 字符支持有限。需要稳定输入复杂文本时，后续应采用 IME 或剪贴板策略。

## 截图与模板匹配

```typescript
const cap = await phone.capture();

const match = await phone.find("./button.png", {
  confidence: 0.9,
  scale: true,
});

await phone.tap(match.center.x, match.center.y);
```

Android 匹配结果使用 `android-device` 坐标空间，即设备截图坐标。

## 多设备

```typescript
const group = await android.connectAll();

await group.tapAll(320, 900);
await group.swipeAll({ x: 500, y: 1600 }, { x: 500, y: 500 });

const captures = await group.captureAll();
for (const item of captures) {
  console.log(item.serial, item.ok);
}
```

多设备操作会并发调度到所有 authorized 设备；同一设备上的命令仍保持串行。

## MCP 中使用

在 MCP Server 中启用 Android 工具：

```json
{
  "env": {
    "SPOTTERJS_ANDROID_ADB": "1"
  }
}
```

工具列表和请求形状见 [MCP Server](../MCP.md)。

## 常见问题

- `adb` 找不到：确认 Android SDK platform-tools 已安装，或设置 `SPOTTERJS_ADB_PATH`。
- `unauthorized`：重新插拔 USB，在手机上接受授权，必要时执行 `adb kill-server`。
- 无线调试连接失败：确认配对端口和连接端口没有混用。
- 多设备误操作：先调用 `android.discover()` 打印 serial，再显式 `connect({ serial })`。
