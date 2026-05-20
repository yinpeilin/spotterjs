import { describe, it, expect, vi } from "vitest";
import type { MatchProvider, Region } from "@spotter/base";

vi.mock("./native", () => ({
  loadNative: () => ({
    getScreenWidth: () => 1920,
    getScreenHeight: () => 1080,
    getScreenSize: () => ({ width: 1920, height: 1080 }),
    captureScreen: () => ({ data: Buffer.alloc(0), width: 0, height: 0 }),
  }),
}));

import { useMatchPlugin, getMatchProvider, screen } from "./screen";

describe("useMatchPlugin", () => {
  it("replaces the active match provider", async () => {
    const custom: MatchProvider = {
      find: async () => ({ left: 99, top: 88, width: 1, height: 1 }),
      findAll: async () => [],
      waitFor: async () => ({ left: 0, top: 0, width: 1, height: 1 }),
    };
    useMatchPlugin(custom);
    expect(getMatchProvider()).toBe(custom);
    const region: Region = await screen.find("x.png");
    expect(region.left).toBe(99);
    expect(region.top).toBe(88);
  });
});
