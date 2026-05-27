import { loadNative } from "@spotterjs/core/unstable-native";
import { screen } from "@spotterjs/core";
import { info, runSmokeScript } from "../lib/log";

export async function run(): Promise<void> {
  const native = loadNative();
  const version = native.version();
  if (!version || version.trim().length === 0) {
    throw new Error("native.version() returned empty string");
  }
  info(`version: ${version}`);

  const { width, height } = screen.size();
  if (width <= 0 || height <= 0) {
    throw new Error(`invalid screen size: ${width}x${height}`);
  }
  info(`screen: ${width}x${height}`);
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("01-version-screen") ?? false;

if (isDirect) {
  void runSmokeScript("01-version-screen", run);
}
