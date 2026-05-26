# Publishing

[中文文档](../zh-CN/PUBLISHING.md)

This maintainer guide covers changesets, license sync, native optional
packages, and npm publishing order.

## Pre-Publish Checks

```bash
npm ci
npm run docs:check
npm run build:ts
npm test
npm run sync-license
npm run verify-pack
```

If the change touches native behavior, also run native build and smoke checks on
the relevant platform:

```bash
npm run build:native
npm run smoke
```

## Git Remote

```bash
git remote add origin git@gitee.com:ypl0lpy/spotterjs.git
git push -u origin master
```

HTTPS clone:

```bash
git clone https://gitee.com/ypl0lpy/spotterjs.git
```

## Changesets

User-visible changes need a changeset:

```bash
npm run changeset
npm run version-packages
```

Review generated versions, changelogs, and dependency ranges before publishing.

## License Sync

```bash
npm run sync-license
```

This copies the root license into npm package directories. Review the diff after
syncing.

## Native Platform Packages

`@spotterjs/node` is the JavaScript loader. Platform binaries are optional
packages:

- `@spotterjs/node-win32-x64-msvc`
- `@spotterjs/node-linux-x64-gnu`

Publish platform packages first, then `@spotterjs/node`, then TypeScript
packages that depend on it.

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

### JavaScript Loader

```bash
npm publish -w @spotterjs/node
```

## TypeScript Packages

Publish in dependency order:

```bash
npm publish -w @spotterjs/base
npm publish -w @spotterjs/core
npm publish -w @spotterjs/mcp
npm publish -w @spotterjs/plugin-ocr
npm publish -w @spotterjs/plugin-android-adb
```

With changesets:

```bash
npm run release
```

Confirm `NPM_TOKEN` and registry configuration before publishing.

## Post-Publish Verification

Install in a clean directory:

```bash
npm init -y
npm install @spotterjs/core
node -e "const s=require('@spotterjs/core'); console.log(Object.keys(s).slice(0, 5))"
```

Verify MCP:

```bash
npx @modelcontextprotocol/inspector npx @spotterjs/mcp
```

## Commercial License

For commercial authorization, contact `ypl123698745@qq.com` or use
[Gitee Issues](https://gitee.com/ypl0lpy/spotterjs/issues).
