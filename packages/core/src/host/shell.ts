import { spawn } from "child_process";
import { getHostConfig } from "./config";
import { HostPathError, resolveWorkspacePath } from "./paths";

export type ShellKind = "powershell" | "bash" | "custom";

/** Current shell information for generating platform-correct commands. */
export type ShellInfo = {
  platform: NodeJS.Platform;
  shell: ShellKind;
  executable: string;
  hint: string;
};

/** Return the default shell, or the `SPOTTERJS_SHELL` override when set. */
export function getShellInfo(): ShellInfo {
  if (process.env.SPOTTERJS_SHELL?.trim()) {
    return {
      platform: process.platform,
      shell: "custom",
      executable: process.env.SPOTTERJS_SHELL.trim(),
      hint: `Commands run via SPOTTERJS_SHELL (${process.env.SPOTTERJS_SHELL}).`,
    };
  }
  if (process.platform === "win32") {
    return {
      platform: process.platform,
      shell: "powershell",
      executable: "powershell.exe",
      hint: "Use PowerShell syntax (e.g. Get-ChildItem, Get-Location).",
    };
  }
  return {
    platform: process.platform,
    shell: "bash",
    executable: "/bin/bash",
    hint: "Use bash syntax (e.g. ls, pwd).",
  };
}

function buildSpawnArgs(command: string): { executable: string; args: string[] } {
  const custom = process.env.SPOTTERJS_SHELL?.trim();
  if (custom) {
    return { executable: custom, args: ["-c", command] };
  }
  if (process.platform === "win32") {
    return {
      executable: "powershell.exe",
      args: ["-NoProfile", "-NonInteractive", "-Command", command],
    };
  }
  return { executable: "/bin/bash", args: ["-lc", command] };
}

/** Shell command execution result. */
export type ExecResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  shell: ShellKind;
};

/**
 * Execute a shell command inside the workspace.
 *
 * Requires `SPOTTERJS_ALLOW_SHELL=1` or
 * `configureHost({ allowShell: true })`. Windows uses PowerShell `-Command`;
 * Linux uses `bash -lc`.
 *
 * @param opts.cwd Working directory relative to the workspace. Defaults to the workspace root.
 * @param opts.timeoutMs Timeout in milliseconds. Defaults to `HostConfig.execTimeoutMs`.
 */
export function execCommand(
  command: string,
  opts?: { cwd?: string; timeoutMs?: number }
): Promise<ExecResult> {
  const { allowShell, workspaceRoot, execTimeoutMs } = getHostConfig();
  if (!allowShell) {
    return Promise.reject(
      new HostPathError(
        "shell execution disabled; set SPOTTERJS_ALLOW_SHELL=1 to enable host.exec",
        "HOST_SHELL_DISABLED"
      )
    );
  }
  const info = getShellInfo();
  const { executable, args } = buildSpawnArgs(command);
  let cwd: string;
  try {
    cwd = opts?.cwd ? resolveWorkspacePath(opts.cwd) : workspaceRoot;
  } catch (error) {
    return Promise.reject(error);
  }
  const timeout = opts?.timeoutMs ?? execTimeoutMs;
  const maxBytes = getHostConfig().maxBytes;

  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(executable, args, {
      cwd,
      windowsHide: true,
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      reject(error);
    };
    const append = (stream: "stdout" | "stderr", chunk: unknown) => {
      const text = chunk?.toString() ?? "";
      const nextBytes = Buffer.byteLength(stream === "stdout" ? stdout + text : stderr + text);
      if (nextBytes > maxBytes) {
        fail(new HostPathError(`command ${stream} output exceeds limit ${maxBytes}`, "HOST_SHELL_OUTPUT_LIMIT", {
          stream,
          maxBytes,
        }));
        return;
      }
      if (stream === "stdout") stdout += text;
      else stderr += text;
    };
    child.stdout?.on("data", (d) => {
      append("stdout", d);
    });
    child.stderr?.on("data", (d) => {
      append("stderr", d);
    });
    const timer = setTimeout(() => {
      fail(new HostPathError(`command timed out after ${timeout}ms`, "HOST_SHELL_TIMEOUT", {
        timeoutMs: timeout,
      }));
    }, timeout);
    child.on("error", (err) => {
      fail(err);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        exitCode: code,
        stdout,
        stderr,
        shell: info.shell,
      });
    });
  });
}
