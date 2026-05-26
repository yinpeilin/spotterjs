import { describe, it, expect, beforeEach } from "vitest";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { configureHost, host, HostPathError } from "./index";

describe("host", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spotterjs-host-"));
    configureHost({ workspaceRoot: tmp, allowShell: false, maxBytes: 4096 });
  });

  it("reads and writes inside workspace", () => {
    host.writeFile("a.txt", "hello");
    expect(host.readFile("a.txt")).toBe("hello");
  });

  it("rejects path outside workspace", () => {
    expect(() => host.readFile("../../../etc/passwd")).toThrow(HostPathError);
    try {
      host.readFile("../../../etc/passwd");
    } catch (error) {
      expect(error).toMatchObject({
        name: "HostPathError",
        code: "HOST_PATH_OUTSIDE_WORKSPACE",
        context: {
          userPath: "../../../etc/passwd",
        },
      });
    }
  });

  it("rejects shell cwd outside workspace", async () => {
    configureHost({ workspaceRoot: tmp, allowShell: true });

    await expect(
      host.exec("echo should-not-run", { cwd: path.dirname(tmp) })
    ).rejects.toThrow(HostPathError);
  });

  it("rejects shell output that exceeds maxBytes", async () => {
    configureHost({ workspaceRoot: tmp, allowShell: true, maxBytes: 128 });
    const node = process.execPath;
    const command =
      process.platform === "win32"
        ? `& "${node}" -e "process.stdout.write('x'.repeat(1024))"`
        : `"${node}" -e "process.stdout.write('x'.repeat(1024))"`;

    await expect(host.exec(command)).rejects.toThrow(/output exceeds/i);
  });

  it("getShellInfo reflects platform", () => {
    const info = host.getShellInfo();
    if (process.platform === "win32") {
      expect(info.shell).toBe("powershell");
    } else {
      expect(info.shell).toBe("bash");
    }
  });
});
