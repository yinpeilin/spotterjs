import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { CommandRegistry } from "./registry.js";
import { ok, registerSafeTool, registerSequenceTool } from "./tools/results.js";

function fixture() {
  const registry = new CommandRegistry();
  const calls: string[] = [];
  registerSafeTool(registry, "write", {
    description: "Write text",
    inputSchema: { text: z.string() },
  }, async ({ text }) => {
    calls.push(text);
    if (text === "fail") throw new Error("write failed");
    return ok(text);
  });
  registerSequenceTool(registry);
  return { registry, calls };
}

describe("local command registry", () => {
  it("lists discoverable JSON schemas and rejects duplicate registration", () => {
    const { registry } = fixture();
    const command = registry.list().find(({ name }) => name === "write");
    expect(command).toMatchObject({
      name: "write", description: "Write text",
      inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false },
    });
    expect(() => registry.registerTool("write", {}, () => ok())).toThrow("Duplicate");
  });

  it("rejects unknown commands and invalid or misspelled arguments before side effects", async () => {
    const { registry, calls } = fixture();
    expect((await registry.execute("missing")).success).toBe(false);
    expect((await registry.execute("write", { text: 42 })).success).toBe(false);
    expect((await registry.execute("write", { text: "hello", typo: true })).success).toBe(false);
    expect(calls).toEqual([]);
  });

  it("validates the entire sequence before the first action", async () => {
    const { registry, calls } = fixture();
    for (const invalid of [
      { name: "missing" },
      { name: "write", arguments: { text: 42 } },
      { name: "spotter_run_sequence", arguments: { steps: [] } },
    ]) {
      const result = await registry.execute("spotter_run_sequence", { steps: [
        { name: "write", arguments: { text: "first" } }, invalid,
      ] });
      expect(result.success).toBe(false);
      expect(calls).toEqual([]);
    }
  });

  it("stops a sequence on failure and reports completed steps without replay", async () => {
    const { registry, calls } = fixture();
    const result = await registry.execute("spotter_run_sequence", { steps: [
      { name: "write", arguments: { text: "first" } },
      { name: "write", arguments: { text: "fail" } },
      { name: "write", arguments: { text: "last" } },
    ] });
    expect(result).toMatchObject({ success: false, data: { completed: 1, failedIndex: 1 } });
    expect(calls).toEqual(["first", "fail"]);
    expect(await registry.execute("write", { text: "next" })).toEqual(ok("next"));
  });

  it("serializes simultaneous sequences and ordinary commands", async () => {
    const { registry, calls } = fixture();
    const result = await Promise.all([
      registry.execute("spotter_run_sequence", { steps: [
        { name: "write", arguments: { text: "one" } },
        { name: "write", arguments: { text: "two" } },
      ] }),
      registry.execute("write", { text: "three" }),
    ]);
    expect(result.every(({ success }) => success)).toBe(true);
    expect(calls).toEqual(["one", "two", "three"]);
  });

  it("observes cancellation before commands and between sequence actions", async () => {
    const { registry, calls } = fixture();
    const abort = new AbortController();
    registerSafeTool(registry, "cancel", {}, () => { abort.abort(); return ok(); });
    const result = await registry.execute("spotter_run_sequence", { steps: [
      { name: "cancel" }, { name: "write", arguments: { text: "skipped" } },
    ] }, abort.signal);
    expect(result).toMatchObject({ success: false, data: { completed: 1, failedIndex: 1 } });
    expect(calls).toEqual([]);
    expect((await registry.execute("write", { text: "skipped" }, abort.signal)).success).toBe(false);
  });

  it("runs all cleanup callbacks once and blocks further execution", async () => {
    const { registry } = fixture();
    const cleanup = vi.fn();
    registry.registerCleanup(cleanup);
    registry.registerCleanup(() => { throw new Error("cleanup failure"); });
    await expect(registry.close()).rejects.toThrow("Command cleanup failed");
    await registry.close();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect((await registry.execute("write", { text: "closed" })).success).toBe(false);
  });
});
