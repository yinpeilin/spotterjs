# Mobile Companion App

[English documentation](../../en/guides/mobile-companion.md)

`apps/mobile-companion` 是 Spotter 的 Android companion app。它提供手机侧 WebSocket 配对、截图、无障碍树和输入能力，由桌面 TypeScript API 或 CLI 访问。

## 国内镜像

PowerShell 当前会话：

```powershell
$env:PUB_HOSTED_URL = "https://pub.flutter-io.cn"
$env:FLUTTER_STORAGE_BASE_URL = "https://storage.flutter-io.cn"
$env:PATH = "$env:USERPROFILE\.spotter-tools\flutter\bin;$env:PATH"
```

安装 Flutter：

```powershell
git clone --depth 1 -b stable https://gitee.com/mirrors/Flutter.git $env:USERPROFILE\.spotter-tools\flutter
```

可选安装 JDK 和 Android platform-tools：

```powershell
.\scripts\setup-mobile-companion.ps1 -InstallJdk -InstallPlatformTools
```

## 开发命令

从仓库根目录运行：

```powershell
npm run mobile:doctor
npm run mobile:check
npm run mobile:build:debug
npm run mobile:build:release
```

`mobile:check` 会依次运行 `flutter analyze` 和 `flutter test`。根脚本优先使用
PATH 里的 Flutter；Windows 下如果找不到，会回退到
`$env:USERPROFILE\.spotter-tools\flutter`。也可以通过 `SPOTTERJS_FLUTTER_BIN`
指定 Flutter 可执行文件。

依赖已经准备好时，可以跳过再次解析 pub 依赖：

```powershell
node scripts/mobile-companion.mjs check --no-pub
```

首次检出或修改依赖后，先在 app 目录运行 `flutter pub get`。
包装脚本的 analyze、test 和 APK 构建命令也支持 `--no-pub`。

也可以直接运行 Flutter 命令：

```powershell
cd apps\mobile-companion
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
flutter build apk --release --split-per-abi
```

## 配对协议

手机端显示局域网 WebSocket 地址、端口和六位配对码。桌面端先发送：

```json
{
  "type": "pair",
  "protocolVersion": 2,
  "clientId": "desktop-dev",
  "code": "123456"
}
```

配对成功后手机返回 `sessionToken`。后续 `heartbeat` 和 `status` 等消息必须携带该 token。

多指手势示例：

```json
{
  "type": "gesture",
  "sessionToken": "<token>",
  "strokes": [
    {
      "points": [{ "x": 120, "y": 800 }, { "x": 120, "y": 500 }],
      "durationMs": 300
    },
    {
      "points": [{ "x": 360, "y": 800 }, { "x": 360, "y": 500 }],
      "durationMs": 300
    }
  ]
}
```

## 权限边界

- `MediaProjection` 需要用户确认，授权后通过配对 WebSocket 返回 PNG 截图。
  Android 14+ 要求截图运行在声明为 `mediaProjection` 的前台服务中。
- `AccessibilityService` 需要用户在系统设置里手动开启，提供无障碍树、手势和输入操作。
- Spotter Keyboard 需要用户启用并选为输入法，以通过 `InputConnection.commitText` 输入文字。
- 自动化连接以 companion app 的 WebSocket 协议为准。

## 发布注意事项

Debug APK 只用于本地开发。内部测试可以使用 split-ABI release APK：

```powershell
npm run mobile:build:release
```

公开分发前，需要把 `apps/mobile-companion/android/app/build.gradle.kts` 里的 debug signing config 替换为项目正式 keystore 策略；当前配置只适合内部测试。
