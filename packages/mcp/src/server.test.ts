import { beforeEach, describe, expect, it, vi } from "vitest";

const core = vi.hoisted(() => ({
  accessibility: {
    enable: vi.fn(),
  },
  configureHost: vi.fn(),
}));

const mcpSdk = vi.hoisted(() => ({
  connect: vi.fn(),
  McpServer: vi.fn(function McpServer(this: { connect: typeof mcpSdk.connect }) {
    this.connect = mcpSdk.connect;
  }),
  StdioServerTransport: vi.fn(),
}));

const desktopTools = vi.hoisted(() => ({
  registerDesktopTools: vi.fn(),
}));

const hostTools = vi.hoisted(() => ({
  registerHostTools: vi.fn(),
}));

const ocrTools = vi.hoisted(() => ({
  registerOcrTools: vi.fn(),
}));

const visualTools = vi.hoisted(() => ({
  registerVisualTools: vi.fn(),
}));

const androidTools = vi.hoisted(() => ({
  registerAndroidTools: vi.fn(),
}));

vi.mock("@spotterjs/core", () => core);

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: mcpSdk.McpServer,
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: mcpSdk.StdioServerTransport,
}));

vi.mock("./tools/desktop.js", () => ({
  registerDesktopTools: desktopTools.registerDesktopTools,
}));

vi.mock("./tools/host.js", () => ({
  registerHostTools: hostTools.registerHostTools,
}));

vi.mock("./tools/ocr.js", () => ({
  registerOcrTools: ocrTools.registerOcrTools,
}));

vi.mock("./tools/visual.js", () => ({
  registerVisualTools: visualTools.registerVisualTools,
}));

vi.mock("./tools/android.js", () => ({
  registerAndroidTools: androidTools.registerAndroidTools,
}));

import { registerOptionalAndroidTools, runSpotterMcp } from "./server.js";

beforeEach(() => {
  delete process.env.SPOTTERJS_A11Y;
  delete process.env.SPOTTERJS_ANDROID;
  delete process.env.SPOTTERJS_WORKSPACE_ROOT;
  delete process.env.SPOTTERJS_ALLOW_SHELL;
  core.accessibility.enable.mockReset();
  core.configureHost.mockReset();
  mcpSdk.connect.mockReset();
  mcpSdk.McpServer.mockClear();
  mcpSdk.StdioServerTransport.mockClear();
  desktopTools.registerDesktopTools.mockReset();
  hostTools.registerHostTools.mockReset();
  ocrTools.registerOcrTools.mockReset();
  visualTools.registerVisualTools.mockReset();
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

describe("runSpotterMcp", () => {
  it("enables accessibility before registering desktop a11y tools", async () => {
    process.env.SPOTTERJS_A11Y = "1";

    await runSpotterMcp();

    expect(core.accessibility.enable).toHaveBeenCalledTimes(1);
    expect(desktopTools.registerDesktopTools).toHaveBeenCalledWith(
      expect.any(Object),
      true
    );
    expect(core.accessibility.enable.mock.invocationCallOrder[0]).toBeLessThan(
      desktopTools.registerDesktopTools.mock.invocationCallOrder[0]
    );
  });

  it("does not enable accessibility when a11y tools are disabled", async () => {
    await runSpotterMcp();

    expect(core.accessibility.enable).not.toHaveBeenCalled();
    expect(desktopTools.registerDesktopTools).toHaveBeenCalledWith(
      expect.any(Object),
      false
    );
    expect(ocrTools.registerOcrTools).toHaveBeenCalledWith(expect.any(Object));
    expect(visualTools.registerVisualTools).toHaveBeenCalledWith(expect.any(Object));
  });

  it("registers Android companion tools when enabled", async () => {
    process.env.SPOTTERJS_ANDROID = "1";

    await runSpotterMcp();

    expect(androidTools.registerAndroidTools).toHaveBeenCalledWith(expect.any(Object));
  });
});
