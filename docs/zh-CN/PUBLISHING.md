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

如果改动涉及 `apps/mobile-companion`，还需要运行：

```bash
npm run mobile:check
npm run mobile:build:release
```

## 本地验证尚未发布的 CLI

在首次发布新的 `@spotterjs/cli` 包之前，用已构建的源码入口和本地包验证器检查当前检出：

```bash
npm run build
node packages/cli/dist/cli.js --help
node packages/cli/dist/cli.js list --all
node packages/cli/dist/cli.js schema desktop_a11y_action
npm run verify:cli-install
```

验证器打包当前 workspaces，准备本机 native 平台包，在新建的临时项目中安装这些 tarball，
验证安装后的可执行文件、命令 schema、stdin/Unicode JSON、序列、Skill 安装和 native 加载。
运行前先完整构建所有包，包括 native 代码。`verify-pack` 单独检查包内容，不执行发布；
检查 CLI 包内包含 `dist/cli.js`、运行时文件、`skills/spotterjs/SKILL.md`、
Skill 参考文件和 `LICENSE`。

发布后验证部分的 `npx @spotterjs/cli` 使用 registry 中的已发布包，不能用于选择当前源码版本。
保留原有包的历史 changelog，新 CLI 的发布记录由其自己的 changeset 生成。

## Git 远程

```bash
git remote add origin git@github.com:yinpeilin/spotterjs.git
git push -u origin master
```

HTTPS clone：

```bash
git clone https://github.com/yinpeilin/spotterjs.git
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

## Native 平台包

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

### JS 加载器

平台包发布后，先检查精确的 optional dependency 版本在 npm 中可用：

```bash
npm run verify:native-published
```

然后发布 loader：

```bash
npm publish -w @spotterjs/node
```

## TypeScript 包

按依赖顺序发布：

```bash
npm publish -w @spotterjs/base
npm publish -w @spotterjs/core
npm publish -w @spotterjs/plugin-ocr
npm publish -w @spotterjs/plugin-android
npm publish -w @spotterjs/cli
```

如果使用 changesets publish：

```bash
npm run release
```

发布前确认 `NPM_TOKEN` 可用，并且 npm registry 指向公开 registry。

## Mobile companion APK

手机端 companion app 以 Android APK 分发，不作为 npm 包发布。从仓库根目录构建 split-ABI release APK：

```bash
npm run mobile:build:release
```

产物位于 `apps/mobile-companion/build/app/outputs/flutter-apk/`。

公开分发前，需要把 `apps/mobile-companion/android/app/build.gradle.kts` 中的 debug signing config 替换为项目正式 keystore 策略。当前 debug-signed release build 只适合内部测试，不应公开发布。

## 发布后验证

在一个干净目录安装并验证：

```bash
npm init -y
npm install @spotterjs/core
node -e "const s=require('@spotterjs/core'); console.log(Object.keys(s).slice(0, 5))"
```

CLI 包验证：

```bash
npx @spotterjs/cli --help
npx @spotterjs/cli list
npx @spotterjs/cli skill path
```

## 授权说明

商用授权请联系 `ypl123698745@qq.com` 或通过 [GitHub Issues](https://github.com/yinpeilin/spotterjs/issues) 处理。
