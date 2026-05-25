#!/usr/bin/env node
/**
 * Install local packed native packages in a clean temp project and require them.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const temp = mkdtempSync(join(tmpdir(), "spotter-native-install-"));

function npm(args, options = {}) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    throw new Error("Missing npm_execpath; run this script through npm scripts.");
  }
  execFileSync(process.execPath, [npmCli, ...args], {
    cwd: options.cwd ?? temp,
    stdio: "inherit",
  });
}

function node(args, options = {}) {
  execFileSync(process.execPath, args, {
    cwd: options.cwd ?? temp,
    stdio: "inherit",
  });
}

try {
  npm(["init", "-y"]);
  npm([
    "install",
    join(root, "crates", "spotterjs-node", "win32-x64-msvc"),
    join(root, "crates", "spotterjs-node"),
  ]);
  node([
    "-e",
    "console.log(require.resolve('@spotterjs/node-win32-x64-msvc')); console.log(require('@spotterjs/node').version())",
  ]);
  console.log(`verify-local-native-install: ok (${pathToFileURL(temp).href})`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
