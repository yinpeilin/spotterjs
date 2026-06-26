import { beforeEach, describe, expect, it, vi } from "vitest";

const startInputListener = vi.fn();
const stopInputListener = vi.fn();
const registerHotkey = vi.fn();
const unregisterHotkey = vi.fn();

vi.mock("./native", () => ({
  loadNative: () => ({
    startInputListener,
    stopInputListener,
    registerHotkey,
    unregisterHotkey,
  }),
}));

import { events } from "./events";

beforeEach(() => {
  startInputListener.mockReset();
  stopInputListener.mockReset();
  registerHotkey.mockReset();
  unregisterHotkey.mockReset();
});

describe("events.on", () => {
  it("parses native JSON events and returns a stop handle", () => {
    const seen: unknown[] = [];
    const handle = events.on((event) => seen.push(event));
    const callback = startInputListener.mock.calls[0]![0] as (json: string) => void;

    callback(JSON.stringify({ type: "key", key: "A", pressed: true, tMs: 12 }));
    handle.stop();

    expect(seen).toEqual([{ type: "key", key: "A", pressed: true, tMs: 12 }]);
    expect(stopInputListener).toHaveBeenCalledTimes(1);
  });
});

describe("events.registerHotkey", () => {
  it("registers a native hotkey and returns an unregister handle", () => {
    const handler = vi.fn();
    const handle = events.registerHotkey(["Ctrl", "S"], handler);
    const [id, keys, callback] = registerHotkey.mock.calls[0]!;

    expect(typeof id).toBe("string");
    expect(keys).toEqual(["Ctrl", "S"]);
    callback(id);
    expect(handler).toHaveBeenCalledTimes(1);

    handle.unregister();
    expect(unregisterHotkey).toHaveBeenCalledWith(id);
  });
});
