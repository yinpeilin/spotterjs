# spotterjs 发布手册

这份手册面向维护者，覆盖 changeset、license 同步、native optional package 和 npm 发布顺序。

## 发布前检查

```bash
npm ci
npm run docs:check
npm run build:ts
npm test
npm run sync-license
npm run verify-pack
```

如果改动涉及 native 能力，还需要在对应平台运行 native 构建和 Smoke：

```bash
npm run build:native
npm run smoke
```

## Git 远程

```bash
git remote add origin git@gitee.com:ypl0lpy/spotterjs.git
git push -u origin master
```

HTTPS clone：

```bash
git clone https://gitee.com/ypl0lpy/spotterjs.git
```

## Changesets 流程

用户可见变更需要 changeset：

```bash
npm run changeset
npm run version-packages
```

检查生成的版本号、CHANGELOG 和 package 依赖范围后再发布。

## License 同步

发布前运行：

```bash
npm run sync-license
```

该命令把根许可证同步到各 npm 包。同步后检查 diff，确认没有覆盖包内必须保留的文件。

## Native platform packages

`@spotterjs/node` 是 JS loader。平台二进制作为 optional package 发布：

- `@spotterjs/node-win32-x64-msvc`
- `@spotterjs/node-linux-x64-gnu`

必须先发布平台包，再发布 `@spotterjs/node`，最后发布依赖它的 TypeScript 包。

### Windows x64

```bash
npm run build -w @spotterjs/node
node scripts/prepare-native-package.mjs win32-x64-msvc
npm publish ./crates/spotterjs-node/win32-x64-msvc
```

### Linux x64 glibc

```bash
npm run build:linux -w @spotterjs/node
node scripts/prepare-native-package.mjs linux-x64-gnu
npm publish ./crates/spotterjs-node/linux-x64-gnu
```

### JS loader

平台包发布后：

```bash
npm publish -w @spotterjs/node
```

## TypeScript packages

按依赖顺序发布：

```bash
npm publish -w @spotterjs/base
npm publish -w @spotterjs/core
npm publish -w @spotterjs/mcp
npm publish -w @spotterjs/plugin-ocr
npm publish -w @spotterjs/plugin-android-adb
```

如果使用 changesets publish：

```bash
npm run release
```

发布前确认 `NPM_TOKEN` 可用，并且 npm registry 指向公开 registry。

## 发布后验证

在一个干净目录安装并验证：

```bash
npm init -y
npm install @spotterjs/core
node -e "const s=require('@spotterjs/core'); console.log(Object.keys(s).slice(0, 5))"
```

MCP 包验证：

```bash
npx @modelcontextprotocol/inspector npx @spotterjs/mcp
```

## 授权说明

商用授权请联系 `ypl123698745@qq.com` 或通过 [Gitee Issues](https://gitee.com/ypl0lpy/spotterjs/issues) 处理。
