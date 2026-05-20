import type { MatchOptions, MatchProvider } from "@spotter/base";
import { screen, useMatchPlugin } from "@spotter/core";
import { loadOpenCvNative } from "./native";

export interface OpencvMatcherOptions {
  multiScale?: boolean;
  scaleMin?: number;
  scaleMax?: number;
  scaleStep?: number;
}

function toNativeOpts(
  options?: MatchOptions,
  plugin?: OpencvMatcherOptions
) {
  return {
    confidence: options?.confidence,
    searchRegion: options?.searchRegion,
    multiScale: plugin?.multiScale ?? options?.multiScale,
    scaleMin: plugin?.scaleMin ?? options?.scaleMin,
    scaleMax: plugin?.scaleMax ?? options?.scaleMax,
    scaleStep: plugin?.scaleStep ?? options?.scaleStep,
  };
}

export function createOpencvMatchProvider(
  pluginOptions?: OpencvMatcherOptions
): MatchProvider {
  const opencv = loadOpenCvNative();

  const run = (needle: string | Buffer) => {
    const path = typeof needle === "string" ? needle : "";
    const buffer = typeof needle === "string" ? null : needle;
    return { path, buffer };
  };

  async function find(needle: string | Buffer, options?: MatchOptions) {
    const hay = screen.capture(options?.searchRegion);
    const { path, buffer } = run(needle);
    return opencv.findTemplate(
      hay,
      path,
      buffer,
      toNativeOpts(options, pluginOptions)
    );
  }

  async function findAll(needle: string | Buffer, options?: MatchOptions) {
    const hay = screen.capture(options?.searchRegion);
    const { path, buffer } = run(needle);
    return opencv.findAllTemplates(
      hay,
      path,
      buffer,
      toNativeOpts(options, pluginOptions)
    );
  }

  async function waitFor(
    needle: string | Buffer,
    timeoutMs: number,
    options?: MatchOptions,
    intervalMs = 200
  ) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        return await find(needle, options);
      } catch {
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    }
    throw new Error(`waitFor timed out after ${timeoutMs}ms`);
  }

  return { find, findAll, waitFor };
}

export function useOpencvMatcher(pluginOptions?: OpencvMatcherOptions): void {
  useMatchPlugin(createOpencvMatchProvider(pluginOptions));
}

export { loadOpenCvNative };
