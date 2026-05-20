#!/usr/bin/env node
/**
 * Dry-run npm pack for publishable workspaces (no publish).
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspaces = [
  "@spotter/base",
  "@spotter/core",
  "@spotter/plugin-ocr",
  "@spotter/plugin-match-opencv",
  "@spotter-rs/node",
  "@spotter-rs/node-match-opencv",
];

for (const ws of workspaces) {
  console.log(`\n--- npm pack ${ws} ---`);
  execSync(`npm pack -w ${ws} --dry-run`, { cwd: root, stdio: "inherit" });
}

console.log("\nverify-pack: ok");
