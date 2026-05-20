import type { CaptureImage, MatchOptions, MatchProvider, Region } from "@spotter/base";
import { createNccMatchProvider, captureForMatch } from "./match";
import { loadNative } from "./native";

let matchProvider: MatchProvider = createNccMatchProvider();

export function useMatchPlugin(provider: MatchProvider): void {
  matchProvider = provider;
}

export function getMatchProvider(): MatchProvider {
  return matchProvider;
}

export const screen = {
  width(): number {
    return loadNative().getScreenWidth();
  },
  height(): number {
    return loadNative().getScreenHeight();
  },
  size(): { width: number; height: number } {
    return loadNative().getScreenSize();
  },
  capture(region?: Region): CaptureImage {
    return captureForMatch(region);
  },
  find(needle: string | Buffer, options?: MatchOptions): Promise<Region> {
    return matchProvider.find(needle, options);
  },
  findAll(needle: string | Buffer, options?: MatchOptions): Promise<Region[]> {
    return matchProvider.findAll(needle, options);
  },
  waitFor(
    needle: string | Buffer,
    timeoutMs: number,
    options?: MatchOptions,
    intervalMs?: number
  ): Promise<Region> {
    return matchProvider.waitFor(needle, timeoutMs, options, intervalMs);
  },
};
