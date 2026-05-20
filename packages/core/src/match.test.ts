import { describe, it, expect, vi, beforeEach } from "vitest";

const findTemplate = vi.fn();
const findAllTemplates = vi.fn();
const waitForTemplate = vi.fn();

vi.mock("./native", () => ({
  loadNative: () => ({
    findTemplate,
    findAllTemplates,
    waitForTemplate,
  }),
}));

import { createNccMatchProvider } from "./match";

beforeEach(() => {
  findTemplate.mockReset();
  findAllTemplates.mockReset();
  waitForTemplate.mockReset();
  findTemplate.mockResolvedValue({ left: 0, top: 0, width: 10, height: 10 });
  findAllTemplates.mockResolvedValue([]);
  waitForTemplate.mockResolvedValue({ left: 0, top: 0, width: 10, height: 10 });
});

describe("createNccMatchProvider", () => {
  it("maps confidence and searchRegion to native findTemplate", async () => {
    const provider = createNccMatchProvider();
    await provider.find("needle.png", {
      confidence: 0.85,
      searchRegion: { left: 1, top: 2, width: 3, height: 4 },
    });
    expect(findTemplate).toHaveBeenCalledWith("needle.png", {
      confidence: 0.85,
      searchRegion: { left: 1, top: 2, width: 3, height: 4 },
      multiScale: undefined,
      scaleMin: undefined,
      scaleMax: undefined,
      scaleStep: undefined,
    });
  });

  it("passes empty path for Buffer needles", async () => {
    const provider = createNccMatchProvider();
    await provider.find(Buffer.from("x"));
    expect(findTemplate).toHaveBeenCalledWith("", expect.anything());
  });
});
