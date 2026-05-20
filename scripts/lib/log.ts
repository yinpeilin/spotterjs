import * as fs from "fs";
import * as path from "path";

export function pass(name: string, detail?: string): void {
  console.log(`[PASS] ${name}${detail ? ` — ${detail}` : ""}`);
}

export function fail(name: string, err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[FAIL] ${name} — ${msg}`);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  throw err instanceof Error ? err : new Error(msg);
}

export function info(msg: string): void {
  console.log(`  ${msg}`);
}

export function getOutputDir(): string {
  return path.resolve(process.cwd(), "test-output");
}

export function ensureOutputDir(): string {
  const dir = getOutputDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function runSmokeScript(
  name: string,
  fn: () => Promise<void>
): Promise<void> {
  try {
    await fn();
    pass(name);
  } catch (err) {
    fail(name, err);
  }
}
