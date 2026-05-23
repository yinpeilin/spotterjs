import { beforeEach, describe, expect, it, vi } from "vitest";

const androidTools = vi.hoisted(() => ({
  registerAndroidTools: vi.fn(),
}));

vi.mock("./tools/android.js", () => ({
  registerAndroidTools: androidTools.registerAndroidTools,
}));

import { registerOptionalAndroidTools } from "./server.js";

beforeEach(() => {
  androidTools.registerAndroidTools.mockReset();
});

describe("registerOptionalAndroidTools", () => {
  it("does not load Android tools when disabled", async () => {
    const server = {} as never;

    await registerOptionalAndroidTools(server, false);

    expect(androidTools.registerAndroidTools).not.toHaveBeenCalled();
  });

  it("registers Android tools when enabled", async () => {
    const server = {} as never;

    await registerOptionalAndroidTools(server, true);

    expect(androidTools.registerAndroidTools).toHaveBeenCalledWith(server);
  });
});
