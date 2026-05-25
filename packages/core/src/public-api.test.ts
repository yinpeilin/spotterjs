import { describe, expect, it, vi } from "vitest";

vi.mock("./native", () => ({
  loadNative: () => ({}),
}));

import * as core from "./index";

describe("public API surface", () => {
  it("exports stable high-level namespaces from the root entrypoint", () => {
    expect(core.screen).toBeDefined();
    expect(core.windows).toBeDefined();
    expect(core.image).toBeDefined();
    expect(core.mouse).toBeDefined();
    expect(core.keyboard).toBeDefined();
  });

  it("does not export removed root-level escape hatches or legacy helpers", () => {
    expect("windowApi" in core).toBe(false);
    expect("findInWindow" in core).toBe(false);
    expect("findAllInWindow" in core).toBe(false);
    expect("tapInWindow" in core).toBe(false);
    expect("loadNative" in core).toBe(false);
    expect("findInCapture" in core).toBe(false);
    expect("findAllInCapture" in core).toBe(false);
    expect("waitForInCapture" in core).toBe(false);
  });
});
