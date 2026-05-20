# Spotter Smoke 与 Integration 脚本

## 构建

```bash
cargo build -p spotter-node
cd crates/spotter-node && npm install && npm run build
cd ../..
npm install
npm run build --workspace=@spotter/base
npm run build --workspace=@spotter/core
```

## Smoke

```bash
npm run smoke
```

含版本、截屏、剪贴板、窗口、模板自匹配、记事本 UIA 等。

## 微信发消息（唯一入口）

**模板匹配**点击会话行 + **剪贴板**输入，不用 OCR。

1. 准备模板：`assets/wechat/templates/file-transfer-assistant.png`（见该目录 README）
2. 运行：

```bash
npm run integration:wechat:send
```

```powershell
$env:WECHAT_MESSAGE="你好"
$env:WECHAT_CONTACT_TEMPLATE="C:\path\to\contact-row.png"  # 可选
npm run integration:wechat:send
```

会发送真实消息，发送后请目视确认。

## 无障碍（UIA）调试

仅调试树结构，不参与发消息：

```bash
npm run integration:wechat:dump
```

## 安全

- `integration:wechat:send` 会操作真实微信并发消息。
