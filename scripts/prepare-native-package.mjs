#!/usr/bin/env node
/**
 * Ensure a platform-specific native npm package has its binary before publish.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const triple = process.argv[2];
const binaries = {
  "win32-x64-msvc": "index.win32-x64-msvc.node",
  "linux-x64-gnu": "index.linux-x64-gnu.node",
};

if (!triple || !binaries[triple]) {
  throw new Error(`Unknown native package target: ${triple || "<missing>"}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nativeRoot = join(root, "crates", "spotterjs-node");
const source = join(nativeRoot, binaries[triple]);
const targetDir = join(nativeRoot, triple);

if (!existsSync(source)) {
  throw new Error(`Missing ${binaries[triple]}. Run npm run build -w @spotterjs/node on ${triple} before publishing.`);
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, join(targetDir, binaries[triple]));
copyFileSync(join(root, "LICENSE"), join(targetDir, "LICENSE"));
console.log(`prepare-native-package: ${triple}/${binaries[triple]}`);
