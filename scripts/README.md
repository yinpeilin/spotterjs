# spotterjs scripts

这个目录包含 Smoke、integration、benchmark 和维护脚本。总览见 [文档示例地图](../docs/examples.md) 和 [测试指南](../docs/development/testing.md)。

## 构建

```bash
cargo build -p spotterjs-node
cd crates/spotterjs-node && npm install && npm run build
cd ../..
npm install
npm run build --workspace=@spotterjs/base
npm run build --workspace=@spotterjs/core
```

## Smoke

```bash
npm run smoke
npm run smoke:ncc:synthetic
npm run smoke:match-tap
npm run smoke:desktop
npm run smoke:android
```

Smoke 脚本会控制本机桌面或连接的 Android 设备。运行前请确认当前环境可以接受窗口聚焦、鼠标移动、键盘输入或设备点击。

## 微信

共享逻辑与坐标系位于 `scripts/integration/lib/wechat-contact.ts`。

| npm 命令 | 脚本 | 说明 |
|----------|------|------|
| `integration:wechat:match` | `wechat-match.ts` | 匹配左侧会话并点击 |
| `integration:wechat:send` | `wechat-send.ts` | 匹配、输入并发送消息 |
| `integration:wechat:dump` | `06-uia-dump-wechat.ts` | UIA 树调试，不发送消息 |

模板与变量说明：`assets/wechat/templates/README.md`

```powershell
$env:WECHAT_MESSAGE="你好"
npm run integration:wechat:send
```

`integration:wechat:send` 会向真实微信发送消息，运行前必须确认模板、联系人和消息内容。

## 维护脚本

- `sync-license.mjs`：同步许可证到各包。
- `verify-pack.mjs`：检查发布包内容。
- `check-doc-links.mjs`：检查 Markdown 本地相对链接。
- `prepare-native-package.mjs` / `prepare-native-packages.mjs`：准备 native optional package。
- `prepare-ocr-models.mjs`：准备 OCR 模型 manifest。
