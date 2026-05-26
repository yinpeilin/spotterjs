import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaptureImage } from "@spotterjs/base";

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
  imageFind: vi.fn(),
  imageFindAll: vi.fn(),
  imageDecode: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: mocks.execFile,
}));

vi.mock("@spotterjs/core", () => ({
  image: {
    find: mocks.imageFind,
    findAll: mocks.imageFindAll,
    decode: mocks.imageDecode,
  },
}));

import {
  AdbError,
  AndroidAutomationError,
  android,
} from "./index";
import { parseAdbDevices } from "./discovery";
import { escapeAdbText } from "./input";

function mockExec(stdout: string | Buffer, stderr = "") {
  mocks.execFile.mockImplementation((_file, _args, _options, cb) => {
    cb(null, stdout, stderr);
  });
}

function mockExecError(error: NodeJS.ErrnoException, stderr = "") {
  mocks.execFile.mockImplementation((_file, _args, _options, cb) => {
    cb(error, "", stderr);
  });
}

const capture: CaptureImage = {
  data: Buffer.from("rgba"),
  width: 2,
  height: 1,
};

beforeEach(() => {
  mocks.execFile.mockReset();
  mocks.imageFind.mockReset();
  mocks.imageFindAll.mockReset();
  mocks.imageDecode.mockReset();
  mocks.imageDecode.mockReturnValue(capture);
});

describe("parseAdbDevices", () => {
  it("parses USB, TCP, emulator, offline, and unauthorized devices", () => {
    const devices = parseAdbDevices(`List of devices attached
emulator-5554 device product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64 transport_id:1
192.168.1.8:5555 device product:phone model:Pixel_8 transport_id:2
ZX1G22 offline product:a model:B
BAD unauthorized
`);

    expect(devices).toEqual([
      {
        serial: "emulator-5554",
        state: "device",
        connection: "emulator",
        product: "sdk_gphone64_x86_64",
        model: "sdk_gphone64_x86_64",
        transportId: "1",
      },
      {
        serial: "192.168.1.8:5555",
        state: "device",
        connection: "network",
        product: "phone",
        model: "Pixel_8",
        transportId: "2",
      },
      {
        serial: "ZX1G22",
        state: "offline",
        connection: "usb",
        product: "a",
        model: "B",
      },
      {
        serial: "BAD",
        state: "unauthorized",
        connection: "usb",
      },
    ]);
  });
});

describe("android ADB commands", () => {
  it("discovers devices from adb devices -l", async () => {
    mockExec("List of devices attached\nUSB123 device model:Pixel\n");

    const devices = await android.discover({ adbPath: "adb.exe" });

    expect(mocks.execFile).toHaveBeenCalledWith(
      "adb.exe",
      ["devices", "-l"],
      expect.any(Object),
      expect.any(Function)
    );
    expect(devices).toEqual([
      {
        serial: "USB123",
        state: "device",
        connection: "usb",
        model: "Pixel",
      },
    ]);
  });

  it("connects the default device when exactly one device is available", async () => {
    mockExec("List of devices attached\nUSB123 device model:Pixel\n");

    const device = await android.connectDefault({ adbPath: "adb.exe" });

    expect(device.serial).toBe("USB123");
  });

  it("rejects connectDefault when multiple devices are available", async () => {
    mockExec(`List of devices attached
USB123 device model:Pixel
192.168.1.8:5555 device model:Pixel_8
`);

    await expect(android.connectDefault()).rejects.toMatchObject({
      name: "AdbError",
      code: "ADB_MULTIPLE_DEVICES",
      devices: [
        expect.objectContaining({ serial: "USB123" }),
        expect.objectContaining({ serial: "192.168.1.8:5555" }),
      ],
    });
  });

  it("pairs and connects wireless devices", async () => {
    mockExec("Successfully paired to 192.168.1.8:37155\n");

    await android.pairTcp({
      host: "192.168.1.8",
      port: 37155,
      code: "123456",
      adbPath: "adb.exe",
    });

    expect(mocks.execFile).toHaveBeenCalledWith(
      "adb.exe",
      ["pair", "192.168.1.8:37155", "123456"],
      expect.any(Object),
      expect.any(Function)
    );

    mocks.execFile.mockReset();
    mocks.execFile.mockImplementation((_file, args, _options, cb) => {
      if (args[0] === "connect") {
        cb(null, "connected to 192.168.1.8:42173\n", "");
        return;
      }
      cb(
        null,
        "List of devices attached\n192.168.1.8:42173 device model:Pixel_8\n",
        ""
      );
    });

    const device = await android.connectNetwork({
      host: "192.168.1.8",
      port: 42173,
      adbPath: "adb.exe",
    });

    expect(mocks.execFile.mock.calls.map((call) => call[1])).toEqual([
      ["connect", "192.168.1.8:42173"],
      ["devices", "-l"],
    ]);
    expect(device.serial).toBe("192.168.1.8:42173");
  });

  it("connects all available devices and runs batch operations independently", async () => {
    mocks.execFile.mockImplementation((_file, args, _options, cb) => {
      if (args[0] === "devices") {
        cb(
          null,
          `List of devices attached
USB123 device model:Pixel
BAD unauthorized model:Other
192.168.1.8:5555 device model:Pixel_8
`,
          ""
        );
        return;
      }
      if (args.includes("USB123")) {
        cb(null, "", "");
        return;
      }
      cb(new Error("tap failed"), "", "tap failed");
    });

    const group = await android.connectAll({ adbPath: "adb.exe" });
    const results = await group.tapAll(10, 20);

    expect(group.devices.map((device) => device.serial)).toEqual([
      "USB123",
      "192.168.1.8:5555",
    ]);
    expect(group.skipped).toEqual([
      expect.objectContaining({ serial: "BAD", state: "unauthorized" }),
    ]);
    expect(results).toEqual([
      { serial: "USB123", ok: true, value: undefined },
      {
        serial: "192.168.1.8:5555",
        ok: false,
        error: "tap failed",
        code: "ADB_COMMAND_FAILED",
      },
    ]);
  });

  it("adds -s serial to every device input operation", async () => {
    mockExec("");
    const device = await android.connect({ serial: "emulator-5554", adbPath: "adb" });

    await device.tap(10, 20);
    await device.swipe({ x: 1, y: 2 }, { x: 3, y: 4 }, { durationMs: 250 });
    await device.keyevent("BACK");

    expect(mocks.execFile.mock.calls.map((call) => call[1])).toEqual([
      ["-s", "emulator-5554", "shell", "input", "tap", "10", "20"],
      [
        "-s",
        "emulator-5554",
        "shell",
        "input",
        "swipe",
        "1",
        "2",
        "3",
        "4",
        "250",
      ],
      ["-s", "emulator-5554", "shell", "input", "keyevent", "BACK"],
    ]);
  });

  it("rejects invalid numeric input before invoking adb", async () => {
    const device = await android.connect({ serial: "phone" });

    await expect(device.tap(Number.NaN, 1)).rejects.toMatchObject({
      name: "AndroidAutomationError",
      code: "ANDROID_INVALID_ARGUMENT",
      context: { label: "x" },
    });
    await expect(
      device.swipe({ x: 1, y: 2 }, { x: 3, y: 4 }, { durationMs: -1 })
    ).rejects.toMatchObject({
      name: "AndroidAutomationError",
      code: "ANDROID_INVALID_ARGUMENT",
      context: { label: "durationMs" },
    });
    expect(mocks.execFile).not.toHaveBeenCalled();
  });

  it("escapes text for adb shell input text", async () => {
    expect(escapeAdbText("hello world & test")).toBe("hello%sworld%stest");

    mockExec("");
    const device = await android.connect({ serial: "phone" });
    await device.text("hello world");

    expect(mocks.execFile.mock.calls[0][1]).toEqual([
      "-s",
      "phone",
      "shell",
      "input",
      "text",
      "hello%sworld",
    ]);
  });

  it("captures a screenshot and decodes it into CaptureImage", async () => {
    mockExec(Buffer.from("png"));
    const device = await android.connect({ serial: "phone" });

    const result = await device.capture();

    expect(mocks.execFile.mock.calls[0][1]).toEqual([
      "-s",
      "phone",
      "exec-out",
      "screencap",
      "-p",
    ]);
    expect(mocks.imageDecode).toHaveBeenCalledWith(Buffer.from("png"));
    expect(result).toBe(capture);
  });

  it("runs app start and stop commands", async () => {
    mockExec("");
    const device = await android.connect({ serial: "phone" });

    await device.startApp("com.example", ".MainActivity");
    await device.stopApp("com.example");

    expect(mocks.execFile.mock.calls.map((call) => call[1])).toEqual([
      [
        "-s",
        "phone",
        "shell",
        "am",
        "start",
        "-n",
        "com.example/.MainActivity",
      ],
      ["-s", "phone", "shell", "am", "force-stop", "com.example"],
    ]);
  });

  it("dumps the UIAutomator tree and removes the remote dump file", async () => {
    mocks.execFile.mockImplementation((_file, args, _options, cb) => {
      if (args.includes("uiautomator")) {
        cb(null, "UI hierchary dumped to: /sdcard/window.xml", "");
        return;
      }
      if (args.includes("cat")) {
        cb(
          null,
          `<hierarchy><node text="Login" resource-id="com.example:id/login" class="android.widget.Button" package="com.example" content-desc="Sign in" clickable="true" enabled="true" checked="false" selected="false" scrollable="false" focusable="true" bounds="[10,20][110,70]" /></hierarchy>`,
          ""
        );
        return;
      }
      cb(null, "", "");
    });
    const device = await android.connect({ serial: "phone" });

    const tree = await device.dumpTree({ remotePath: "/sdcard/window.xml" });

    expect(mocks.execFile.mock.calls.map((call) => call[1])).toEqual([
      [
        "-s",
        "phone",
        "shell",
        "uiautomator",
        "dump",
        "/sdcard/window.xml",
      ],
      ["-s", "phone", "exec-out", "cat", "/sdcard/window.xml"],
      ["-s", "phone", "shell", "rm", "-f", "/sdcard/window.xml"],
    ]);
    expect(tree).toMatchObject({
      text: "Login",
      resourceId: "com.example:id/login",
      center: { x: 60, y: 45 },
    });
  });

  it("rejects unsafe UIAutomator remote paths", async () => {
    const device = await android.connect({ serial: "phone" });

    await expect(
      device.dumpTree({ remotePath: "/sdcard/window.xml;rm -rf /" })
    ).rejects.toMatchObject({
      name: "AndroidAutomationError",
      code: "ANDROID_UNSAFE_REMOTE_PATH",
    });
    expect(mocks.execFile).not.toHaveBeenCalled();
  });

  it("cleans the remote UIAutomator dump file when reading the tree fails", async () => {
    mocks.execFile.mockImplementation((_file, args, _options, cb) => {
      if (args.includes("uiautomator")) {
        cb(null, "dumped", "");
        return;
      }
      if (args.includes("cat")) {
        cb(new Error("cat failed"), "", "cat failed");
        return;
      }
      cb(null, "", "");
    });
    const device = await android.connect({ serial: "phone" });

    await expect(
      device.dumpTree({ remotePath: "/sdcard/window.xml" })
    ).rejects.toThrow("cat failed");

    expect(mocks.execFile.mock.calls.map((call) => call[1])).toEqual([
      [
        "-s",
        "phone",
        "shell",
        "uiautomator",
        "dump",
        "/sdcard/window.xml",
      ],
      ["-s", "phone", "exec-out", "cat", "/sdcard/window.xml"],
      ["-s", "phone", "shell", "rm", "-f", "/sdcard/window.xml"],
    ]);
  });

  it("finds and interacts with Android elements from the UI tree", async () => {
    mocks.execFile.mockImplementation((_file, args, _options, cb) => {
      if (args.includes("cat")) {
        cb(
          null,
          `<hierarchy><node text="" class="android.widget.FrameLayout" package="com.example" enabled="true" clickable="false" bounds="[0,0][500,500]"><node text="Search" resource-id="com.example:id/search" class="android.widget.EditText" package="com.example" content-desc="" clickable="true" enabled="true" checked="false" selected="false" scrollable="false" focusable="true" bounds="[20,30][220,90]" /></node></hierarchy>`,
          ""
        );
        return;
      }
      cb(null, "", "");
    });
    const device = await android.connect({ serial: "phone" });

    const element = await device.findElement({ resourceIdContains: "search" });
    const all = await device.findElements({ clickable: true });
    await device.tapElement({ text: "Search" });
    await device.typeElement(element, "hello world");

    expect(element.center).toEqual({ x: 120, y: 60 });
    expect(all.map((node) => node.resourceId)).toEqual(["com.example:id/search"]);
    expect(mocks.execFile.mock.calls.map((call) => call[1])).toContainEqual([
      "-s",
      "phone",
      "shell",
      "input",
      "tap",
      "120",
      "60",
    ]);
    expect(mocks.execFile.mock.calls.map((call) => call[1])).toContainEqual([
      "-s",
      "phone",
      "shell",
      "input",
      "text",
      "hello%sworld",
    ]);
  });

  it("runs common device and app management commands", async () => {
    mocks.execFile.mockImplementation((_file, args, _options, cb) => {
      if (args.includes("size")) {
        cb(null, "Physical size: 1080x2400\n", "");
        return;
      }
      if (args.includes("density")) {
        cb(null, "Physical density: 420\n", "");
        return;
      }
      if (args.includes("dumpsys")) {
        cb(
          null,
          "mCurrentFocus=Window{abc u0 com.example/.MainActivity}\n",
          ""
        );
        return;
      }
      cb(null, "ok\n", "");
    });
    const device = await android.connect({ serial: "phone" });

    await expect(device.shell("echo ok")).resolves.toBe("ok\n");
    await expect(device.getDisplayInfo()).resolves.toEqual({
      width: 1080,
      height: 2400,
      density: 420,
    });
    await device.wake();
    await device.sleep();
    await expect(device.currentApp()).resolves.toEqual({
      packageName: "com.example",
      activity: ".MainActivity",
      raw: "mCurrentFocus=Window{abc u0 com.example/.MainActivity}\n",
    });
    await device.clearApp("com.example");

    expect(mocks.execFile.mock.calls.map((call) => call[1])).toContainEqual([
      "-s",
      "phone",
      "shell",
      "pm",
      "clear",
      "com.example",
    ]);
  });

  it("matches templates against the latest phone capture", async () => {
    mockExec(Buffer.from("png"));
    mocks.imageFind.mockResolvedValue({
      region: { left: 1, top: 2, width: 3, height: 4 },
      center: { x: 2, y: 4 },
      score: 0.9,
    });
    const device = await android.connect({ serial: "phone" });

    const match = await device.find("button.png", { confidence: 0.9 });

    expect(mocks.imageFind).toHaveBeenCalledWith(capture, "button.png", {
      confidence: 0.9,
    });
    expect(match.score).toBe(0.9);
  });

  it("waits for templates by capturing repeatedly", async () => {
    mockExec(Buffer.from("png"));
    mocks.imageFind
      .mockRejectedValueOnce(new Error("not found"))
      .mockResolvedValueOnce({
        region: { left: 1, top: 2, width: 3, height: 4 },
        center: { x: 2, y: 4 },
        score: 0.9,
      });
    const device = await android.connect({ serial: "phone" });

    const match = await device.waitFor("button.png", 1000, { confidence: 0.9 }, 0);

    expect(mocks.execFile).toHaveBeenCalledTimes(2);
    expect(mocks.imageFind).toHaveBeenCalledTimes(2);
    expect(match.score).toBe(0.9);
  });

  it("turns adb failures into structured AdbError values", async () => {
    const err = new Error("spawn adb ENOENT") as NodeJS.ErrnoException;
    err.code = "ENOENT";
    mockExecError(err);

    await expect(android.discover()).rejects.toMatchObject({
      name: "AdbError",
      code: "ADB_NOT_FOUND",
      context: { adbPath: expect.any(String) },
    } satisfies Partial<AdbError>);
  });

  it("throws structured automation errors for element misses", async () => {
    mocks.execFile.mockImplementation((_file, args, _options, cb) => {
      if (args.includes("cat")) {
        cb(null, `<hierarchy><node text="Home" bounds="[0,0][10,10]" /></hierarchy>`, "");
        return;
      }
      cb(null, "", "");
    });
    const device = await android.connect({ serial: "phone" });

    await expect(device.findElement({ text: "Missing" })).rejects.toMatchObject({
      name: "AndroidAutomationError",
      code: "ANDROID_ELEMENT_NOT_FOUND",
    } satisfies Partial<AndroidAutomationError>);
  });
});
