import { spawn } from "child_process";
import { resolveWorkspacePath, statSafe } from "./paths";

/** Open a file or directory with the OS default application. */
export function openPath(targetPath: string): void {
  const resolved = resolveWorkspacePath(targetPath);
  statSafe(resolved);
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", resolved], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();
    return;
  }
  if (process.platform === "darwin") {
    spawn("open", [resolved], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("xdg-open", [resolved], { detached: true, stdio: "ignore" }).unref();
}
