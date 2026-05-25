import type { CaptureImage, Point } from "@spotterjs/base";
import type {
  AndroidBatchResult,
  AndroidDevice,
  AndroidDeviceGroup,
  AndroidDeviceInfo,
} from "./types";

export class AdbDeviceGroup implements AndroidDeviceGroup {
  readonly devices: AndroidDevice[];
  readonly skipped: AndroidDeviceInfo[];

  constructor(devices: AndroidDevice[], skipped: AndroidDeviceInfo[] = []) {
    this.devices = devices;
    this.skipped = skipped;
  }

  tapAll(x: number, y: number): Promise<Array<AndroidBatchResult<void>>> {
    return this.runAll((device) => device.tap(x, y));
  }

  swipeAll(
    from: Point,
    to: Point,
    options?: { durationMs?: number }
  ): Promise<Array<AndroidBatchResult<void>>> {
    return this.runAll((device) => device.swipe(from, to, options));
  }

  captureAll(): Promise<Array<AndroidBatchResult<CaptureImage>>> {
    return this.runAll((device) => device.capture());
  }

  private runAll<T>(
    fn: (device: AndroidDevice) => Promise<T>
  ): Promise<Array<AndroidBatchResult<T>>> {
    return Promise.all(
      this.devices.map(async (device) => {
        try {
          const value = await fn(device);
          return { serial: device.serial, ok: true, value };
        } catch (error) {
          return {
            serial: device.serial,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );
  }
}
