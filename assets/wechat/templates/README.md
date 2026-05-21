# 微信模板图

微信自动化使用 **NCC 模板匹配** + 剪贴板输入（不用 OCR）。

## 准备联系人行

1. 打开微信，左侧列表里能看到 **文件传输助手**。
2. 从当前微信窗口 **原尺寸** 截图，保存为 `file-transfer-assistant.png`：

   - **推荐**：整行（左侧图标 + 昵称），宽约 280–380px、高 48–72px  
   - **可用**：仅昵称条（深灰底 + 白字），背景须与当前深色主题一致；勿用整块亮绿底

3. 换主题 / 缩放显示后需重新截图。

## 命令

| 命令 | 作用 |
|------|------|
| `npm run integration:wechat:match` | 匹配会话行并点击 |
| `npm run integration:wechat:send` | 匹配 → 输入 → 发送 |

```bash
# 只测匹配、不点击
$env:WECHAT_NO_TAP="1"
npm run integration:wechat:match

# 只测匹配、不发送
$env:WECHAT_PROBE="1"
npm run integration:wechat:send
```

## 坐标系

脚本与 `captureWindow` / `findInWindow` 使用同一套 **虚拟桌面屏幕像素**（Windows 多显示器下 `GetWindowRect` 坐标系）：

| 名称 | 含义 |
|------|------|
| **窗口内** `(x,y)` | 相对微信外框左上角，与 `test-output/wechat-contact-match.png` 红框/绿十字一致 |
| **屏幕** `(x,y)` | 虚拟桌面绝对坐标；副屏窗口 `left` 常 ≥ 主屏宽度（如主屏 1920 宽、微信在 2203） |
| **点击** | 匹配框中心（`matchTapScreen` = `centerOf(screen)`）；绿十字与点击点一致 |

鼠标：`SendInput` + `MOUSEEVENTF_VIRTUALDESK`，与截图/窗口 API 对齐，避免 Enigo 在双屏+DPI 下偏移数百像素。

`getScreenSize()` 仅返回**主显示器**尺寸；定位副屏窗口请用 `getWindowRegion` / 匹配输出的屏幕坐标。

调试图：`test-output/wechat-contact-match.png`（设 `WECHAT_DEBUG=1` 或多候选时自动保存）

## 环境变量

| 变量 | 说明 |
|------|------|
| `WECHAT_CONTACT_TEMPLATE` | 联系人行 PNG 路径 |
| `WECHAT_SEND_TEMPLATE` | 可选「发送」按钮小图；不设则 Enter |
| `WECHAT_MESSAGE` | 发送正文 |
| `WECHAT_MATCH_CONFIDENCE` | 默认 `0.72` |
| `WECHAT_CONTACT_ROW` | 多候选时选第几个（0=最上） |
| `WECHAT_CONTACT_Y` | 多候选时选最接近该窗口内 Y 的行 |
| `WECHAT_NO_TAP` | `1` = match 脚本不点击 |
| `WECHAT_PROBE` | `1` = send 脚本只匹配不发送；match 脚本也不点击 |
| `WECHAT_DEBUG` | `1` = 始终保存调试图 |
| `WECHAT_EXE` | 微信安装路径 |

## UIA 调试（不参与发消息）

```bash
npm run integration:wechat:dump
```
