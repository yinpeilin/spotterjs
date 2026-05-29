#!/usr/bin/env node
/**
 * Keep platform native packages aligned with the @spotterjs/node loader.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nativeRoot = join(root, "crates", "spotterjs-node");
const loaderPackagePath = join(nativeRoot, "package.json");
const platformPackagePaths = [
  {
    path: join(nativeRoot, "win32-x64-msvc", "package.json"),
  },
  {
    path: join(nativeRoot, "linux-x64-gnu", "package.json"),
  },
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const loaderPackage = readJson(loaderPackagePath);

for (const { path: packagePath } of platformPackagePaths) {
  const platformPackage = readJson(packagePath);
  platformPackage.version = loaderPackage.version;
  writeJson(packagePath, platformPackage);
  loaderPackage.optionalDependencies[platformPackage.name] = loaderPackage.version;
  console.log(`sync-native-package-versions: ${platformPackage.name}@${loaderPackage.version}`);
}

writeJson(loaderPackagePath, loaderPackage);
