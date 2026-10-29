# 桌面与 Android 的 CLI 序列编排

[English](../../en/guides/sequences.md)

用 `spotterjs sequence --file plan.json` 在同一 CLI 进程中运行有关联的操作，
让 Android 连接和执行队列保持到整段流程结束。CLI 在启动它的机器上执行，
不启动远程执行端或网络控制器。

## 桌面示例

先运行 `spotterjs run desktop_list_windows`，确认目标窗口 ID，
再保存 `plan.json`：

```json
[
  { "name": "desktop_focus_window", "arguments": { "windowId": "123456" } },
  { "name": "desktop_keyboard_type", "arguments": { "text": "你好 😀\n第二行", "mode": "native" } },
  { "name": "desktop_capture_active", "arguments": { "detail": "original" } }
]
```

```bash
spotterjs sequence --file plan.json
```

把 `123456` 替换成实际观察到的窗口 ID，输入前确认目标编辑控件已获得焦点。
默认使用 native Unicode 输入；显式选择 paste 模式时，可为慢应用设置 `pasteDelayMs`。

## Android 会话示例

启用 Android 命令，将 connect 和后续动作放到同一个计划中：

```powershell
$env:SPOTTERJS_ANDROID = '1'
spotterjs sequence --file phones.json
```

```json
[
  { "name": "android_connect", "arguments": { "deviceId": "phone-1", "url": "ws://192.168.1.23:17341", "sessionToken": "saved-token" } },
  { "name": "android_launch_app", "arguments": { "deviceId": "phone-1", "packageName": "com.android.settings" } },
  { "name": "android_current_app", "arguments": { "deviceId": "phone-1" } },
  { "name": "android_capture_screen", "arguments": { "deviceId": "phone-1", "detail": "original" } }
]
```

首次配对时，在 connect 步骤用 `code` 替代 `sessionToken`。每台手机使用独立的
`deviceId`。进程结束即关闭连接，下次可用返回的 token 重连；含 token 的计划文件应妥善保存。
分开运行 Android 动作时，每次都传 `url` 和 `sessionToken`，不能依赖上一次进程缓存的设备 ID。

## 执行边界

- 每段计划为 1–100 步。未知命令和无效参数会在执行首个动作前拒绝。
- 步骤按顺序占用当前进程的执行队列，首个失败会停止计划，返回完成数量和失败索引。
- 已完成的动作不会回滚或自动重试。超时或失败后先观察实际状态，再决定是否重新执行。
- 不同 CLI 进程之间不共享队列。避免并发进程争用同一桌面的焦点、键盘和剪贴板。
- 步骤只使用字面参数，不会把前一步返回值自动代入后一步。
  需要动态分支、轮询、消费上一步结果的流程，使用 TypeScript API 编排。

更多说明见 [CLI + Skill](../CLI.md)、[桌面自动化](./desktop-automation.md)和
[Android companion](./android-companion.md)。
