# Mobile Companion App

`apps/mobile-companion` 是 Spotter 的 Android companion app。首版目标是建立手机和桌面 MCP/bridge 的连接闭环，后续再承载截图、无障碍树和输入能力。

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

```powershell
cd apps\mobile-companion
flutter pub get
flutter test
flutter build apk
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

- `MediaProjection` 需要用户确认，首版只完成授权入口。
- `AccessibilityService` 需要用户在系统设置里手动开启，首版声明服务和权限状态。
- 自动化连接以 companion app 的 WebSocket 协议为准。
