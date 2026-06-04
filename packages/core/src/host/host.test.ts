import { describe, it, expect, beforeEach } from "vitest";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { SpotterError } from "../errors";
import { configureHost, host } from "./index";

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

  it("reads raw buffers and reports directory metadata", () => {
    host.writeFile("nested/bin.dat", Buffer.from([1, 2, 3]));
    host.writeFile("nested/readme.txt", "hello");

    const raw = host.readFile("nested/bin.dat", { encoding: null });
    const entries = host.listDir("nested");
    const meta = host.stat("nested/readme.txt");

    expect(Buffer.isBuffer(raw)).toBe(true);
    expect([...Buffer.from(raw as Buffer)]).toEqual([1, 2, 3]);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "bin.dat",
          path: "nested/bin.dat",
          isFile: true,
          isDirectory: false,
          size: 3,
        }),
        expect.objectContaining({
          name: "readme.txt",
          path: "nested/readme.txt",
          isFile: true,
          isDirectory: false,
          size: 5,
        }),
      ])
    );
    expect(meta).toMatchObject({
      path: "nested/readme.txt",
      isFile: true,
      isDirectory: false,
      size: 5,
    });
  });

  it("rejects writes to denylisted filenames", () => {
    expect(() => host.writeFile(".env", "SECRET=1")).toThrow(SpotterError);

    try {
      host.writeFile(".env", "SECRET=1");
    } catch (error) {
      expect(error).toMatchObject({
        name: "SpotterError",
        code: "SPOTTER_HOST_WRITE_DENIED",
        domain: "host",
        context: { basename: ".env" },
      });
    }
  });

  it("rejects path outside workspace", () => {
    expect(() => host.readFile("../../../etc/passwd")).toThrow(SpotterError);
    try {
      host.readFile("../../../etc/passwd");
    } catch (error) {
      expect(error).toMatchObject({
        name: "SpotterError",
        code: "SPOTTER_HOST_PATH_OUTSIDE_WORKSPACE",
        domain: "host",
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
    ).rejects.toThrow(SpotterError);
  });

  it("rejects shell execution when disabled", async () => {
    await expect(host.exec("echo no-shell")).rejects.toMatchObject({
      name: "SpotterError",
      code: "SPOTTER_HOST_SHELL_DISABLED",
      domain: "host",
    });
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
