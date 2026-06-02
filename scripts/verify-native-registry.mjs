#!/usr/bin/env node
/**
 * Verify that @spotterjs/node optional native packages exist on npm at the
 * exact versions required by the loader package.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const loaderPackagePath = join(root, "crates", "spotterjs-node", "package.json");
const loaderPackage = JSON.parse(readFileSync(loaderPackagePath, "utf8"));
const optionalDependencies = loaderPackage.optionalDependencies ?? {};

const publishDirs = {
  "@spotterjs/node-win32-x64-msvc": "crates/spotterjs-node/win32-x64-msvc",
  "@spotterjs/node-linux-x64-gnu": "crates/spotterjs-node/linux-x64-gnu",
};

function npm(args) {
  const npmCli = process.env.npm_execpath;
  if (npmCli) {
    return execFileSync(process.execPath, [npmCli, ...args], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  return execFileSync("npm", args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function publishedVersion(name, version) {
  const output = npm(["view", `${name}@${version}`, "version", "--json"]).trim();
  return JSON.parse(output);
}

const missing = [];

for (const [name, version] of Object.entries(optionalDependencies)) {
  try {
    const published = publishedVersion(name, version);
    if (published !== version) {
      missing.push({ name, version, reason: `registry returned ${published}` });
    }
  } catch (error) {
    missing.push({
      name,
      version,
      reason: error.stderr?.toString().trim() || error.message,
    });
  }
}

if (missing.length > 0) {
  const lines = missing.flatMap(({ name, version, reason }) => {
    const dir = publishDirs[name] ?? "<native-package-dir>";
    return [
      `- ${name}@${version} is not published or is not readable from npm.`,
      `  publish: npm publish ./${dir}`,
      `  detail: ${reason}`,
    ];
  });

  throw new Error(
    [
      `@spotterjs/node@${loaderPackage.version} requires native optional packages that are missing from npm.`,
      "Publish the platform packages first, then publish @spotterjs/node and dependent TypeScript packages.",
      ...lines,
    ].join("\n"),
  );
}

console.log(
  `verify-native-registry: ok (${Object.keys(optionalDependencies).length} optional native packages)`,
);
