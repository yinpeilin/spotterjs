import { clipboard } from "@spotterjs/core";
import { info, runSmokeScript } from "../lib/log";

export async function run(): Promise<void> {
  const token = `spotterjs-smoke-${process.pid}`;
  let previous: string | undefined;
  try { previous = clipboard.get(); } catch { /* Clipboard may have no text. */ }
  try {
    clipboard.set(token);
    const read = clipboard.get();
    if (read !== token) {
      throw new Error(`clipboard mismatch: expected "${token}", got "${read}"`);
    }
    info(`clipboard round-trip ok (${token.length} chars)`);
  } finally {
    if (previous !== undefined) {
      try {
        if (clipboard.get() === token) clipboard.set(previous);
      } catch { /* Preserve clipboard contents copied while the smoke was running. */ }
    }
  }
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("03-clipboard") ?? false;

if (isDirect) {
  void runSmokeScript("03-clipboard", run);
}
