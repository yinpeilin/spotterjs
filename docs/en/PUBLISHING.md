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

If the change touches `apps/mobile-companion`, also run:

```bash
npm run mobile:check
npm run mobile:build:release
```

## Validate the unpublished CLI locally

Use the built source entry and local package verifier to validate a checkout
before publishing the new `@spotterjs/cli` package:

```bash
npm run build
node packages/cli/dist/cli.js --help
node packages/cli/dist/cli.js list --all
node packages/cli/dist/cli.js schema desktop_a11y_action
npm run verify:cli-install
```

The verifier packs the current workspaces, prepares the local native platform
package, and installs the tarballs in a fresh temporary project. It checks the
installed executable, command schemas, stdin/Unicode JSON, sequences, Skill
installation, and native loading. Build all packages, including native code,
first. `verify-pack` separately checks package contents without publishing;
confirm the CLI tarball includes `dist/cli.js`, its runtime files,
`skills/spotterjs/SKILL.md`, the Skill references, and `LICENSE`.

The registry-based `npx @spotterjs/cli` commands in post-publish verification
apply after the package has been published. They do not select the current
source checkout. Keep historical package changelogs intact; the new CLI's
release entries are generated from its own changesets.

## Git Remote

```bash
git remote add origin git@github.com:yinpeilin/spotterjs.git
git push -u origin master
```

HTTPS clone:

```bash
git clone https://github.com/yinpeilin/spotterjs.git
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

After the platform packages are published, verify the exact optional dependency
versions exist on npm:

```bash
npm run verify:native-published
```

```bash
npm publish -w @spotterjs/node
```

## TypeScript Packages

Publish in dependency order:

```bash
npm publish -w @spotterjs/base
npm publish -w @spotterjs/core
npm publish -w @spotterjs/plugin-ocr
npm publish -w @spotterjs/plugin-android
npm publish -w @spotterjs/cli
```

With changesets:

```bash
npm run release
```

Confirm `NPM_TOKEN` and registry configuration before publishing.

## Mobile Companion APK

The mobile companion app is distributed as an Android APK, not as an npm
package. Build split-ABI release APKs from the repository root:

```bash
npm run mobile:build:release
```

Review the APKs under
`apps/mobile-companion/build/app/outputs/flutter-apk/`.

Before public distribution, replace the debug signing config in
`apps/mobile-companion/android/app/build.gradle.kts` with the project release
keystore policy. Do not publish the current debug-signed release build outside
internal testing.

## Post-Publish Verification

Install in a clean directory:

```bash
npm init -y
npm install @spotterjs/core
node -e "const s=require('@spotterjs/core'); console.log(Object.keys(s).slice(0, 5))"
```

Verify CLI:

```bash
npx @spotterjs/cli --help
npx @spotterjs/cli list
npx @spotterjs/cli skill path
```

## Commercial License

For commercial authorization, contact `ypl123698745@qq.com` or use
[GitHub Issues](https://github.com/yinpeilin/spotterjs/issues).
