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
