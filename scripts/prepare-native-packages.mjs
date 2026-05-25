#!/usr/bin/env node
/**
 * Copy built napi binaries into platform-specific npm packages.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nativeRoot = join(root, "crates", "spotterjs-node");
const license = join(root, "LICENSE");
const releaseRoot = join(root, "target", "release");

const packages = [
  {
    triple: "win32-x64-msvc",
    binary: "index.win32-x64-msvc.node",
    releaseBinary: "spotterjs_node.dll",
  },
  {
    triple: "linux-x64-gnu",
    binary: "index.linux-x64-gnu.node",
  },
];

let copied = 0;

for (const pkg of packages) {
  const sourceCandidates = [
    pkg.releaseBinary ? join(releaseRoot, pkg.releaseBinary) : undefined,
    join(nativeRoot, pkg.binary),
  ].filter(Boolean);
  const source = sourceCandidates.find((candidate) => existsSync(candidate));
  if (!source) {
    console.log(`prepare-native-packages: skip ${pkg.triple} (missing ${pkg.binary})`);
    continue;
  }

  const dir = join(nativeRoot, pkg.triple);
  mkdirSync(dir, { recursive: true });
  copyFileSync(source, join(dir, pkg.binary));
  copyFileSync(license, join(dir, "LICENSE"));
  console.log(`prepare-native-packages: ${pkg.triple}/${pkg.binary}`);
  copied += 1;
}

if (copied === 0) {
  throw new Error("No native binaries were found. Run npm run build -w @spotterjs/node first.");
}
