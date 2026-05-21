import { spawn } from "child_process";
import { getHostConfig } from "./config";
import { HostPathError } from "./paths";

export type ShellKind = "powershell" | "bash" | "custom";

export type ShellInfo = {
  platform: NodeJS.Platform;
  shell: ShellKind;
  executable: string;
  hint: string;
};

export function getShellInfo(): ShellInfo {
  if (process.env.SPOTTER_SHELL?.trim()) {
    return {
      platform: process.platform,
      shell: "custom",
      executable: process.env.SPOTTER_SHELL.trim(),
      hint: `Commands run via SPOTTER_SHELL (${process.env.SPOTTER_SHELL}).`,
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
  const custom = process.env.SPOTTER_SHELL?.trim();
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

export type ExecResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  shell: ShellKind;
};

export function execCommand(
  command: string,
  opts?: { cwd?: string; timeoutMs?: number }
): Promise<ExecResult> {
  const { allowShell, workspaceRoot, execTimeoutMs } = getHostConfig();
  if (!allowShell) {
    return Promise.reject(
      new HostPathError(
        "shell execution disabled; set SPOTTER_ALLOW_SHELL=1 to enable host.exec"
      )
    );
  }
  const info = getShellInfo();
  const { executable, args } = buildSpawnArgs(command);
  const cwd = opts?.cwd
    ? opts.cwd
    : workspaceRoot;
  const timeout = opts?.timeoutMs ?? execTimeoutMs;

  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      windowsHide: true,
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new HostPathError(`command timed out after ${timeout}ms`));
    }, timeout);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
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
