import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const appDir = path.join(repoRoot, "apps", "mobile-companion");

const commandSets = new Map([
  ["check", [["analyze"], ["test"]]],
  ["analyze", [["analyze"]]],
  ["test", [["test"]]],
  ["build:debug", [["build", "apk", "--debug"]]],
  ["build:release", [["build", "apk", "--release", "--split-per-abi"]]],
  ["doctor", [["doctor", "-v"]]],
]);

const command = process.argv[2];
const options = process.argv.slice(3);
if (!command || command === "--help" || command === "-h") {
  printUsage();
  process.exit(command ? 0 : 1);
}

const runs = commandSets.get(command);
if (!runs) {
  console.error(`Unknown mobile companion command: ${command}`);
  printUsage();
  process.exit(1);
}

if (options.some((option) => option !== "--no-pub") ||
    (options.includes("--no-pub") && command === "doctor")) {
  console.error("Only --no-pub is supported for check, analyze, test, and build commands.");
  printUsage();
  process.exit(1);
}

const flutter = findFlutter();
if (!flutter) {
  console.error("Flutter SDK was not found.");
  console.error("Install Flutter and put it on PATH, or run:");
  console.error("  .\\scripts\\setup-mobile-companion.ps1 -InstallJdk -InstallPlatformTools");
  console.error("You can also set SPOTTERJS_FLUTTER_BIN to a flutter executable path.");
  process.exit(1);
}

for (const args of runs) {
  // Windows Flutter uses a batch entry point; quote paths that contain spaces.
  const executable = process.platform === "win32" ? `"${flutter}"` : flutter;
  const result = spawnSync(executable, options.includes("--no-pub") ? [...args, "--no-pub"] : args, {
    cwd: appDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function findFlutter() {
  if (process.env.SPOTTERJS_FLUTTER_BIN) {
    return process.env.SPOTTERJS_FLUTTER_BIN;
  }

  const onPath = findOnPath("flutter");
  if (onPath) return onPath;

  const helper = path.join(
    process.env.USERPROFILE || homedir(),
    ".spotter-tools",
    "flutter",
    "bin",
    process.platform === "win32" ? "flutter.bat" : "flutter",
  );
  if (existsSync(helper)) return helper;

  return null;
}

function findOnPath(executable) {
  const result =
    process.platform === "win32"
      ? spawnSync("where.exe", [executable], { encoding: "utf8" })
      : spawnSync("sh", ["-lc", `command -v ${executable}`], {
          encoding: "utf8",
        });
  if (result.status !== 0) return null;
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}

function printUsage() {
  console.error("Usage: node scripts/mobile-companion.mjs <command> [--no-pub]");
  console.error("Commands: check, analyze, test, build:debug, build:release, doctor");
  console.error("--no-pub skips dependency resolution; run flutter pub get first when needed.");
}
