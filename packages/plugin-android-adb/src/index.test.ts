import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaptureImage } from "@spotterjs/base";

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
  findInCapture: vi.fn(),
  findAllInCapture: vi.fn(),
  loadImageFromBuffer: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: mocks.execFile,
}));

vi.mock("@spotterjs/core", () => ({
  findInCapture: mocks.findInCapture,
  findAllInCapture: mocks.findAllInCapture,
  loadImageFromBuffer: mocks.loadImageFromBuffer,
}));

import {
  AdbError,
  android,
  escapeAdbText,
  parseAdbDevices,
} from "./index";

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
  mocks.findInCapture.mockReset();
  mocks.findAllInCapture.mockReset();
  mocks.loadImageFromBuffer.mockReset();
  mocks.loadImageFromBuffer.mockReturnValue(capture);
});

describe("parseAdbDevices", () => {
  it("parses USB, TCP, offline, and unauthorized devices", () => {
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
        product: "sdk_gphone64_x86_64",
        model: "sdk_gphone64_x86_64",
        transportId: "1",
      },
      {
        serial: "192.168.1.8:5555",
        state: "device",
        product: "phone",
        model: "Pixel_8",
        transportId: "2",
      },
      {
        serial: "ZX1G22",
        state: "offline",
        product: "a",
        model: "B",
      },
      {
        serial: "BAD",
        state: "unauthorized",
      },
    ]);
  });
});

describe("android ADB commands", () => {
  it("lists devices with adb devices -l", async () => {
    mockExec("List of devices attached\nemulator-5554 device model:Pixel\n");

    const devices = await android.listDevices({ adbPath: "adb.exe" });

    expect(mocks.execFile).toHaveBeenCalledWith(
      "adb.exe",
      ["devices", "-l"],
      expect.any(Object),
      expect.any(Function)
    );
    expect(devices[0]).toMatchObject({ serial: "emulator-5554", model: "Pixel" });
  });

  it("connects TCP devices through adb connect", async () => {
    mockExec("connected to 10.0.0.5:5555\n");

    const device = await android.connectTcp("10.0.0.5:5555", {
      adbPath: "adb.exe",
    });

    expect(mocks.execFile).toHaveBeenCalledWith(
      "adb.exe",
      ["connect", "10.0.0.5:5555"],
      expect.any(Object),
      expect.any(Function)
    );
    expect(device.serial).toBe("10.0.0.5:5555");
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
    expect(mocks.loadImageFromBuffer).toHaveBeenCalledWith(Buffer.from("png"));
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

  it("matches templates against the latest phone capture", async () => {
    mockExec(Buffer.from("png"));
    mocks.findInCapture.mockResolvedValue({
      region: { left: 1, top: 2, width: 3, height: 4 },
      center: { x: 2, y: 4 },
      score: 0.9,
    });
    const device = await android.connect({ serial: "phone" });

    const match = await device.find("button.png", { confidence: 0.9 });

    expect(mocks.findInCapture).toHaveBeenCalledWith(capture, "button.png", {
      confidence: 0.9,
    });
    expect(match.score).toBe(0.9);
  });

  it("waits for templates by capturing repeatedly", async () => {
    mockExec(Buffer.from("png"));
    mocks.findInCapture
      .mockRejectedValueOnce(new Error("not found"))
      .mockResolvedValueOnce({
        region: { left: 1, top: 2, width: 3, height: 4 },
        center: { x: 2, y: 4 },
        score: 0.9,
      });
    const device = await android.connect({ serial: "phone" });

    const match = await device.waitFor("button.png", 1000, { confidence: 0.9 }, 0);

    expect(mocks.execFile).toHaveBeenCalledTimes(2);
    expect(mocks.findInCapture).toHaveBeenCalledTimes(2);
    expect(match.score).toBe(0.9);
  });

  it("turns adb failures into structured AdbError values", async () => {
    const err = new Error("spawn adb ENOENT") as NodeJS.ErrnoException;
    err.code = "ENOENT";
    mockExecError(err);

    await expect(android.listDevices()).rejects.toMatchObject({
      name: "AdbError",
      code: "ADB_NOT_FOUND",
    } satisfies Partial<AdbError>);
  });
});
