import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import { runCli } from "./runner.js";
import { CommandRegistry } from "./registry.js";
import { json, registerSequenceTool } from "./tools/results.js";

const scratch: string[] = [];
afterEach(() => {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true });
});
function directory() {
  const value = mkdtempSync(join(tmpdir(), "spotter-cli-test-"));
  scratch.push(value);
  return value;
}
async function invoke(argv: string[], stdin = "") {
  let output = "";
  const executed: string[] = [];
  let closed = false;
  let created = false;
  const registry = new CommandRegistry();
  registry.registerTool("echo", { inputSchema: { text: z.string() } }, ({ text }) => {
    executed.push(text);
    return json(text);
  });
  registry.registerTool("fail", {}, () => { throw new Error("operation failed"); });
  registry.registerCleanup(() => { closed = true; });
  registerSequenceTool(registry);
  const code = await runCli(argv, {
    stdout: (text) => { output += text; },
    readStdin: async () => stdin,
  }, { createRegistry: async () => { created = true; return registry; } });
  return { code, output, executed, closed, created, result: output.startsWith("{") ? JSON.parse(output) : undefined };
}

describe("CLI input and lifecycle", () => {
  it("preserves completed sequence output when cleanup fails", async () => {
    const registry = new CommandRegistry();
    registry.registerTool("echo", {}, () => json("done"));
    registerSequenceTool(registry);
    registry.registerCleanup(() => { throw new Error("cleanup exploded"); });
    let output = "";
    const code = await runCli(["sequence", "--json", '[{"name":"echo"}]'], {
      stdout: (text) => { output += text; }, readStdin: async () => "",
    }, { createRegistry: async () => registry });
    expect(code).toBe(1);
    expect(JSON.parse(output)).toMatchObject({
      success: false,
      data: { completed: 1, results: [{ name: "echo", result: { success: true, data: "done" } }] },
      error: { message: expect.stringContaining("Command cleanup failed") },
    });
  });

  it("preserves the original operation error when cleanup also fails", async () => {
    const registry = new CommandRegistry();
    registry.registerTool("fail", {}, () => { throw new Error("operation exploded"); });
    registry.registerCleanup(() => { throw new Error("cleanup exploded"); });
    let output = "";
    await runCli(["run", "fail"], {
      stdout: (text) => { output += text; }, readStdin: async () => "",
    }, { createRegistry: async () => registry });
    expect(JSON.parse(output).error.message).toContain("operation exploded");
    expect(JSON.parse(output).error.message).toContain("Command cleanup failed");
  });

  it("passes process cancellation into running commands and still cleans the scope", async () => {
    const registry = new CommandRegistry();
    const controller = new AbortController();
    let started = false;
    let closed = false;
    registry.registerTool("wait", {}, (_args, context) => new Promise((_resolve, reject) => {
      started = true;
      context?.signal?.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
    }));
    registry.registerCleanup(() => { closed = true; });
    let output = "";
    const pending = runCli(["run", "wait"], {
      stdout: (text) => { output += text; }, readStdin: async () => "",
    }, { createRegistry: async () => registry }, controller.signal);
    while (!started) await Promise.resolve();
    controller.abort();
    expect(await pending).toBe(1);
    expect(closed).toBe(true);
    expect(JSON.parse(output).error.message).toContain("cancelled");
  });

  it("shows help and version without loading automation", async () => {
    const help = await invoke(["--help"]);
    expect(help.code).toBe(0);
    expect(help.created).toBe(false);
    expect(help.output).toContain("spotterjs");
    const version = await invoke(["--version"]);
    expect(version.output.trim()).toMatch(/^\d+\.\d+\.\d+/);
    expect(version.created).toBe(false);
  });

  it("reads Unicode and a BOM from stdin and closes the scope", async () => {
    const text = "中文 😀\n第二行\t'\"`$()";
    const call = await invoke(["run", "echo", "--stdin"], `\uFEFF${JSON.stringify({ text })}`);
    expect(call.code).toBe(0);
    expect(call.result).toEqual({ success: true, data: text });
    expect(call.executed).toEqual([text]);
    expect(call.closed).toBe(true);
    expect(call.output.trim().split("\n")).toHaveLength(1);
  });

  it("reads arguments from a UTF-8 file", async () => {
    const file = join(directory(), "input.json");
    writeFileSync(file, '\uFEFF{"text":"文件输入"}');
    const call = await invoke(["run", "echo", "--file", file]);
    expect(call.result.data).toBe("文件输入");
  });

  it.each([
    ["run", "echo", "--json", "[]"],
    ["run", "echo", "--json", "null"],
    ["run", "echo", "--json", "{"],
    ["run", "echo", "--json", "{}", "--stdin"],
    ["sequence"],
    ["sequence", "--json", "{}"],
    ["run"],
    ["list", "unexpected"],
    ["--transport", "stdio"],
  ])("rejects malformed CLI input before loading automation: %j", async (...args) => {
    const call = await invoke(args);
    expect(call.code).toBe(1);
    expect(call.result.success).toBe(false);
    expect(call.created).toBe(false);
    expect(call.executed).toEqual([]);
  });

  it("exposes JSON schemas and closes discovery scopes", async () => {
    const call = await invoke(["schema", "echo"]);
    expect(call.result.data.inputSchema.properties.text.type).toBe("string");
    expect(call.closed).toBe(true);
  });

  it("returns nonzero for invalid arguments and operational errors", async () => {
    for (const argv of [["run", "echo", "--json", '{"text":4}'], ["run", "unknown"], ["run", "fail"]]) {
      const call = await invoke(argv);
      expect(call.code).toBe(1);
      expect(call.result.success).toBe(false);
      expect(call.closed).toBe(true);
    }
  });

  it("validates the complete sequence before effects, then fails fast at runtime", async () => {
    const invalid = await invoke(["sequence", "--json", JSON.stringify([
      { name: "echo", arguments: { text: "must not run" } }, { name: "unknown" },
    ])]);
    expect(invalid.executed).toEqual([]);
    const failed = await invoke(["sequence", "--json", JSON.stringify([
      { name: "echo", arguments: { text: "first" } }, { name: "fail" },
      { name: "echo", arguments: { text: "must not run" } },
    ])]);
    expect(failed.code).toBe(1);
    expect(failed.executed).toEqual(["first"]);
    expect(failed.result.data.completed).toBe(1);
    expect(failed.closed).toBe(true);
  });

  it("installs the skill idempotently and protects local edits", async () => {
    const target = directory();
    const argv = ["skill", "install", "--target", target];
    const installed = await invoke(argv);
    expect(installed.code).toBe(0);
    const source = join(installed.result.data.path, "SKILL.md");
    expect(readFileSync(source, "utf8")).toContain("spotterjs");
    expect((await invoke(argv)).code).toBe(0);
    writeFileSync(source, "local changes");
    expect((await invoke(argv)).code).toBe(1);
    expect(readFileSync(source, "utf8")).toBe("local changes");
    expect((await invoke([...argv, "--force"])).code).toBe(0);
  });
});
