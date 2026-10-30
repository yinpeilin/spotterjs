#!/usr/bin/env node
/** Verify npm tarballs in a clean project, including the installed CLI bin and Skill. */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, "Run through npm run verify:cli-install");
const nativeTarget =
  process.platform === "win32" && process.arch === "x64"
    ? "win32-x64-msvc"
    : process.platform === "linux" && process.arch === "x64"
    ? "linux-x64-gnu"
    : undefined;
assert.ok(
  nativeTarget,
  "This install check requires a supported Windows/Linux x64 host"
);
const tempRoot = path.resolve(tmpdir());
const temporary = mkdtempSync(path.join(tempRoot, "spotter-cli-install-"));
const workspace = path.join(temporary, "workspace");
const reportFile = path.join(root, "test-output/precommit/cli-install.json");
const packages = [
  "packages/base",
  "crates/spotterjs-node",
  "packages/core",
  "packages/plugin-ocr",
  "packages/plugin-android",
  "packages/cli",
  `crates/spotterjs-node/${nativeTarget}`,
];
const version = JSON.parse(
  readFileSync(path.join(root, "packages/cli/package.json"), "utf8")
).version;
const checks = [];

function npm(args, cwd = temporary) {
  return execFileSync(process.execPath, [npmCli, ...args], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 8 * 1024 * 1024,
  });
}

function run(args, input, expectedStatus = 0) {
  const cli = path.join(temporary, "node_modules/@spotterjs/cli/dist/cli.js");
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: temporary,
    input: input === undefined ? undefined : JSON.stringify(input),
    env: {
      ...process.env,
      SPOTTERJS_WORKSPACE_ROOT: workspace,
      SPOTTERJS_A11Y: "0",
      SPOTTERJS_ANDROID: "0",
      SPOTTERJS_RECORDING: "0",
      SPOTTERJS_ALLOW_SHELL: "0",
    },
    encoding: "utf8",
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  const output = JSON.parse(result.stdout);
  assert.equal(result.status, expectedStatus, JSON.stringify(output));
  assert.equal(output.success, expectedStatus === 0, JSON.stringify(output));
  return output;
}

try {
  execFileSync(
    process.execPath,
    [path.join(root, "scripts/prepare-native-package.mjs"), nativeTarget],
    { cwd: root, stdio: "inherit", windowsHide: true }
  );
  const tarballs = packages.map((directory) => {
    const packed = JSON.parse(
      npm(
        [
          "pack",
          path.join(root, directory),
          "--ignore-scripts",
          "--json",
          "--pack-destination",
          temporary,
        ],
        root
      )
    )[0];
    if (directory === "packages/cli") {
      assert.ok(
        packed.files.some(
          ({ path: file }) => file === "skills/spotterjs/SKILL.md"
        )
      );
      assert.ok(
        !packed.files.some(({ path: file }) =>
          /(?:server|cluster|mcp)\.[cm]?js$/i.test(file)
        )
      );
    }
    return path.join(temporary, packed.filename);
  });
  writeFileSync(
    path.join(temporary, "package.json"),
    JSON.stringify({
      name: "spotter-cli-install-check",
      private: true,
      type: "module",
    })
  );
  // External libraries are installed normally; lifecycle scripts are disabled so this
  // packaging check does not download optional OCR execution-provider binaries.
  console.log(
    npm([
      "install",
      "--ignore-scripts",
      "--prefer-offline",
      "--no-audit",
      "--no-fund",
      ...tarballs,
    ]).trim()
  );
  assert.equal(
    npm(["exec", "--offline", "--", "spotterjs", "--version"]).trim(),
    version
  );
  checks.push("packed local dependencies and installed CLI bin");
  assert.ok(
    !existsSync(path.join(temporary, "node_modules/@modelcontextprotocol/sdk"))
  );
  const all = run(["list", "--all"]).data;
  for (const name of [
    "desktop_list_windows",
    "desktop_a11y_action",
    "desktop_record_input",
    "android_connect",
  ])
    assert.ok(
      all.some((entry) => entry.name === name),
      `Missing command ${name}`
    );
  assert.equal(
    run(["schema", "desktop_keyboard_type"]).data.inputSchema.properties.text
      .type,
    "string"
  );
  checks.push("command discovery and JSON schemas without a protocol SDK");

  mkdirSync(workspace, { recursive: true });
  const text = "安装验证 中文 😀\nline two\t'\"`$()";
  run(["run", "host_write_file", "--stdin"], {
    path: "unicode.txt",
    content: text,
  });
  assert.equal(
    run(["run", "host_read_file", "--stdin"], { path: "unicode.txt" }).data,
    text
  );
  const sequenceFile = path.join(temporary, "sequence.json");
  writeFileSync(
    sequenceFile,
    JSON.stringify([
      {
        name: "host_write_file",
        arguments: { path: "sequence.txt", content: text },
      },
      { name: "host_read_file", arguments: { path: "sequence.txt" } },
    ])
  );
  const sequence = run(["sequence", "--file", sequenceFile]).data;
  assert.equal(sequence.completed, 2);
  assert.equal(sequence.results[1].result.data, text);
  run(
    ["sequence", "--stdin"],
    [
      {
        name: "host_write_file",
        arguments: { path: "must-not-exist.txt", content: "invalid plan" },
      },
      { name: "unknown_command" },
    ],
    1
  );
  assert.ok(!existsSync(path.join(workspace, "must-not-exist.txt")));
  checks.push("Unicode stdin/file input, sequences and prevalidation");

  assert.ok(Array.isArray(run(["run", "desktop_list_windows"]).data));
  const capture = run(["run", "desktop_capture_screen", "--stdin"], {
    region: { left: 3, top: 5, width: 8, height: 8 },
    detail: "original",
  }).data;
  assert.equal(capture.width, 8);
  assert.equal(capture.height, 8);
  assert.deepEqual(capture.origin, { x: 3, y: 5 });
  assert.equal(capture.coordinateSpace, "screen");
  assert.ok(existsSync(path.resolve(workspace, capture.imagePath)));
  checks.push("installed native loader and workspace capture artifacts");

  const source = run(["skill", "path"]).data.path;
  assert.ok(path.relative(temporary, source).startsWith("node_modules"));
  const installed = run([
    "skill",
    "install",
    "--target",
    path.join(temporary, "skills"),
  ]).data.path;
  assert.match(
    readFileSync(path.join(installed, "SKILL.md"), "utf8"),
    /name: spotterjs/
  );
  checks.push("bundled Skill path and installation");
  const report = {
    status: "passed",
    version,
    platform: `${process.platform}-${process.arch}`,
    packages,
    checks,
  };
  mkdirSync(path.dirname(reportFile), { recursive: true });
  writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} catch (error) {
  mkdirSync(path.dirname(reportFile), { recursive: true });
  writeFileSync(
    reportFile,
    `${JSON.stringify(
      {
        status: "failed",
        checks,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )}\n`
  );
  throw error;
} finally {
  assert.equal(path.dirname(path.resolve(temporary)), tempRoot);
  assert.ok(path.basename(temporary).startsWith("spotter-cli-install-"));
  rmSync(temporary, { recursive: true, force: true });
}
