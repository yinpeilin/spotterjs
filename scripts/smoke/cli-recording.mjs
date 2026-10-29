// Opt-in native desktop recording smoke. Only empty scripts are ever played.
// Cancellation injects SIGINT into the real CLI handler and observes actual native cleanup.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const cli = path.join(root, "packages/cli/dist/cli.js");
const evidence = path.join(root, "test-output/recording-cli");
mkdirSync(evidence, { recursive: true });
const environment = {
  ...process.env,
  SPOTTERJS_RECORDING: "1",
  SPOTTERJS_A11Y: "0",
  SPOTTERJS_ANDROID: "0",
};
function call(name, args) {
  const child = spawnSync(process.execPath, [cli, "run", name, "--stdin"], {
    cwd: root,
    env: environment,
    input: JSON.stringify(args),
    encoding: "utf8",
    windowsHide: true,
    timeout: 15000,
  });
  if (child.error) throw child.error;
  const output = JSON.parse(child.stdout);
  assert.equal(child.status, 0, JSON.stringify(output));
  assert.equal(output.success, true, JSON.stringify(output));
  return output.data;
}
let report;
try {
  const recorded = call("desktop_record_input", { durationMs: 80 });
  assert.equal(typeof recorded.script.durationMs, "number");
  assert.ok(recorded.script.durationMs >= 0);
  assert.equal("duration_ms" in recorded.script, false);
  assert.deepEqual(JSON.parse(recorded.scriptJson), recorded.script);
  for (const event of recorded.script.events) {
    assert.equal("delay_ms" in event, false);
    assert.equal(typeof event.delayMs, "number");
  }
  // Never replay input captured from an actual user's desktop.
  const empty = { ...recorded.script, events: [] };
  assert.equal(
    empty.events.length,
    0,
    "Never replay recorded desktop actions in this smoke"
  );
  assert.deepEqual(call("desktop_play_recording", { script: empty }), {
    played: true,
  });
  assert.deepEqual(
    call("desktop_play_recording", { script: JSON.stringify(empty) }),
    { played: true }
  );
  const wrapper = `
import { recording } from '@spotterjs/core';
const originalStart=recording.start;
const originalStop=recording.stop;
recording.start=(options)=>{ const result=originalStart(options); process.stderr.write('NATIVE_RECORDING_STARTED\\n'); setTimeout(()=>process.emit('SIGINT'),150).unref(); return result; };
recording.stop=()=>{ const result=originalStop(); process.stderr.write('NATIVE_RECORDING_STOPPED\\n'); return result; };
process.argv=[process.execPath,${JSON.stringify(
    cli
  )},'run','desktop_record_input','--json','{"durationMs":10000}'];
await import(${JSON.stringify(pathToFileURL(cli).href)});
`;
  const start = Date.now();
  const cancelled = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", wrapper],
    {
      cwd: root,
      env: environment,
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
    }
  );
  if (cancelled.error) throw cancelled.error;
  const cancellation = JSON.parse(cancelled.stdout);
  assert.equal(cancelled.status, 1, JSON.stringify(cancellation));
  assert.equal(cancellation.success, false);
  assert.match(cancellation.error.message, /cancelled/i);
  assert.equal(
    (cancelled.stderr.match(/NATIVE_RECORDING_STARTED/g) || []).length,
    1,
    cancelled.stderr
  );
  assert.equal(
    (cancelled.stderr.match(/NATIVE_RECORDING_STOPPED/g) || []).length,
    1,
    cancelled.stderr
  );
  assert.ok(
    Date.now() - start < 5000,
    "Cancellation must not wait until the recording duration"
  );
  const cancellationElapsedMs = Date.now() - start;
  const subsequent = call("desktop_record_input", { durationMs: 20 });
  assert.equal(typeof subsequent.script.durationMs, "number");
  report = {
    status: "passed",
    checks: [
      "native camelCase recording JSON",
      "scriptJson consistency",
      "empty object playback",
      "empty JSON string playback",
      "actual CLI SIGINT handler via controlled process.emit injection",
      "actual native stop called exactly once",
      "subsequent native recording succeeds",
    ],
    recordedEventCount: recorded.script.events.length,
    replayedEventCount: 0,
    cancellation,
    cancellationElapsedMs,
    signalMethod:
      "controlled process.emit(SIGINT), because Windows child.kill(SIGINT) forcibly terminates",
  };
} catch (error) {
  report = {
    status: "failed",
    error: error instanceof Error ? error.message : String(error),
  };
  process.exitCode = 1;
}
writeFileSync(
  path.join(evidence, "result.json"),
  JSON.stringify(report, null, 2) + "\n"
);
console.log(JSON.stringify(report));
