#!/usr/bin/env node
/**
 * Dry-run npm pack for publishable workspaces (no publish).
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspaces = [
  "@spotterjs/base",
  "@spotterjs/core",
  "@spotterjs/plugin-ocr",
  "@spotterjs/node",
  "@spotterjs/mcp",
];
const nativePackages = [
  {
    path: "crates/spotterjs-node/win32-x64-msvc",
    binary: "index.win32-x64-msvc.node",
  },
  {
    path: "crates/spotterjs-node/linux-x64-gnu",
    binary: "index.linux-x64-gnu.node",
  },
];

for (const ws of workspaces) {
  console.log(`\n--- npm pack ${ws} ---`);
  execSync(`npm pack -w ${ws} --dry-run`, { cwd: root, stdio: "inherit" });
}

for (const pkg of nativePackages) {
  if (!existsSync(join(root, pkg.path, pkg.binary))) {
    console.log(`\n--- npm pack ${pkg.path} ---`);
    console.log(`skip: missing ${pkg.binary}`);
    continue;
  }

  console.log(`\n--- npm pack ${pkg.path} ---`);
  execSync(`npm pack ./${pkg.path} --dry-run`, { cwd: root, stdio: "inherit" });
}

console.log("\nverify-pack: ok");
