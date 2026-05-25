#!/usr/bin/env node
/**
 * Keep platform native packages aligned with the @spotterjs/node loader.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nativeRoot = join(root, "crates", "spotterjs-node");
const loaderPackagePath = join(nativeRoot, "package.json");
const platformPackagePaths = [
  {
    path: join(nativeRoot, "win32-x64-msvc", "package.json"),
    binary: join(nativeRoot, "win32-x64-msvc", "index.win32-x64-msvc.node"),
  },
  {
    path: join(nativeRoot, "linux-x64-gnu", "package.json"),
    binary: join(nativeRoot, "linux-x64-gnu", "index.linux-x64-gnu.node"),
  },
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const loaderPackage = readJson(loaderPackagePath);

for (const { path: packagePath, binary } of platformPackagePaths) {
  const platformPackage = readJson(packagePath);
  if (!existsSync(binary)) {
    console.log(`sync-native-package-versions: skip ${platformPackage.name} (missing binary)`);
    continue;
  }

  platformPackage.version = loaderPackage.version;
  writeJson(packagePath, platformPackage);
  loaderPackage.optionalDependencies[platformPackage.name] = loaderPackage.version;
  console.log(`sync-native-package-versions: ${platformPackage.name}@${loaderPackage.version}`);
}

writeJson(loaderPackagePath, loaderPackage);
