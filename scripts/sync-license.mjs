#!/usr/bin/env node
/**
 * Copy root LICENSE into each publishable npm package directory for npm pack.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const license = join(root, "LICENSE");
const targets = [
  "packages/base",
  "packages/core",
  "packages/plugin-match-opencv",
  "packages/plugin-ocr",
  "crates/spotter-node",
  "crates/spotter-node-match-opencv",
];

for (const dir of targets) {
  const dest = join(root, dir, "LICENSE");
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(license, dest);
  console.log(`sync-license: ${dir}/LICENSE`);
}
