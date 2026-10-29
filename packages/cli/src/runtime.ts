import { accessibility, configureHost } from "@spotterjs/core";
import { resolve } from "node:path";
import { CommandRegistry } from "./registry.js";
import { registerDesktopTools } from "./tools/desktop.js";
import { registerHostTools } from "./tools/host.js";
import { registerOcrTools } from "./tools/ocr.js";
import { registerRecordingTools } from "./tools/recording.js";
import { registerVisualTools } from "./tools/visual.js";
import { registerSequenceTool } from "./tools/results.js";

function enabled(name: string): boolean {
  return ["1", "true"].includes(process.env[name]?.trim().toLowerCase() ?? "");
}

/** Create one command execution scope; close it to release companion connections. */
export async function createCommandRegistry(options: {
  all?: boolean;
  discovery?: boolean;
  workspace?: string;
} = {}): Promise<CommandRegistry> {
  const a11y = options.all || enabled("SPOTTERJS_A11Y");
  const registry = new CommandRegistry();
  try {
    if (!options.discovery) {
      const workspaceRoot = resolve(options.workspace ?? (process.env.SPOTTERJS_WORKSPACE_ROOT?.trim() || process.cwd()));
      process.env.SPOTTERJS_WORKSPACE_ROOT = workspaceRoot;
      configureHost({ workspaceRoot, allowShell: enabled("SPOTTERJS_ALLOW_SHELL") });
      if (a11y) {
        accessibility.enable();
        registry.registerCleanup(() => accessibility.disable());
      }
    }
    registerHostTools(registry);
    registerOcrTools(registry);
    registerVisualTools(registry);
    registerDesktopTools(registry, !!a11y);
    if (options.all || enabled("SPOTTERJS_RECORDING")) registerRecordingTools(registry);
    if (options.all || enabled("SPOTTERJS_ANDROID")) {
      const { registerAndroidTools } = await import("./tools/android.js");
      registerAndroidTools(registry);
    }
    registerSequenceTool(registry);
    return registry;
  } catch (error) {
    await registry.close();
    throw error;
  }
}
