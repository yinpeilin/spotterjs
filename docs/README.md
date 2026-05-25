# spotterjs 文档

这里是 spotterjs 的完整文档入口。先从“快速开始”和“完整使用手册”进入，再按需要跳到专题文档。

## 先看这些

- [快速开始](./getting-started.md) - 安装、首个脚本、本地验证
- [完整使用手册](./user-manual.md) - 从入门到 MCP 的完整工作流
- [MCP Server](./MCP.md) - 客户端配置、工具列表、安全策略
- [示例](./examples.md) - Paint、Smoke、集成脚本和 benchmark
- [排障](./troubleshooting.md) - native、模板匹配、ADB、OCR、MCP 常见问题

## 按能力查

- [桌面自动化](./guides/desktop-automation.md) - 窗口、截图、键鼠、剪贴板和坐标
- [无障碍自动化](./guides/accessibility.md) - UIA / AT-SPI、树 dump、查找与点击
- [模板匹配](./MATCHING.md) - NCC 参数、Buffer needle、search region
- [Android ADB](./guides/android-adb.md) - USB / 无线调试、多设备和插件 API
- [OCR](./guides/ocr.md) - 模型下载、缓存、坐标和集成测试

## API 入口

- [`@spotterjs/core`](../packages/core/README.md)
- [`@spotterjs/mcp`](../packages/mcp/README.md)
- [`@spotterjs/plugin-android-adb`](../packages/plugin-android-adb/README.md)
- [`@spotterjs/plugin-ocr`](../packages/plugin-ocr/README.md)

## 维护

- [架构说明](./development/architecture.md)
- [测试指南](./development/testing.md)
- [文档规范](./development/documentation-style.md)
- [发布手册](./PUBLISHING.md)
- [贡献指南](../CONTRIBUTING.md)

## 文档检查

```bash
npm run docs:check
```

这个命令只检查本地相对链接。新增或移动文档后，跑一次就够了。
