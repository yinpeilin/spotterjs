# Contributing

欢迎参与 spotterjs。这个仓库同时包含 TypeScript 包、Rust crate、native package、MCP Server、插件和脚本，请在改动前先确认对应边界。

## Setup

```bash
git clone https://github.com/yinpeilin/spotterjs.git
cd spotterjs
npm ci
cargo build -p spotterjs-base -p spotterjs-core -p spotterjs-plugin-match-ncc
cd crates/spotterjs-node && npm install && npm run build
cd ../..
npm run build:ts
```

## Tests

```bash
npm test
npm run docs:check
```

`npm run test:rust` runs the full Rust workspace (`cargo test --workspace`). Desktop Smoke scripts are optional and will control the local desktop.

More details:

- [测试指南](docs/development/testing.md)
- [示例地图](docs/examples.md)
- [排障指南](docs/troubleshooting.md)

## Docs

- [文档入口](docs/README.md)
- [模板匹配](docs/MATCHING.md)
- [MCP Server](docs/MCP.md)
- [架构说明](docs/development/architecture.md)
- [文档规范](docs/development/documentation-style.md)

新增或移动 Markdown 文件后，请运行：

```bash
npm run docs:check
```

## Changesets

User-facing changes need a changeset:

```bash
npm run changeset
```

## Publishing

发布流程见 [发布手册](docs/PUBLISHING.md)。发布前需要确认 license 同步、打包内容和 native optional package 顺序。

## License

By contributing, you agree that your contributions are licensed under [LICENSE](LICENSE) (spotterjs License 1.0). Commercial use of the project by third parties requires separate authorization from the copyright holder.
