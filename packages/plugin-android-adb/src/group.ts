import type { CaptureImage, Point } from "@spotterjs/base";
import type {
  AndroidBatchResult,
  AndroidDevice,
  AndroidDeviceGroup,
  AndroidDeviceInfo,
} from "./types";

/** Batch automation handle that runs supported commands across many Android devices. */
export class AdbDeviceGroup implements AndroidDeviceGroup {
  /** Device handles with adb state `device`. */
  readonly devices: AndroidDevice[];
  /** Discovered devices skipped because they were not ready for automation. */
  readonly skipped: AndroidDeviceInfo[];

  constructor(devices: AndroidDevice[], skipped: AndroidDeviceInfo[] = []) {
    this.devices = devices;
    this.skipped = skipped;
  }

  /** Tap the same Android device pixel coordinate on every available device. */
  tapAll(x: number, y: number): Promise<Array<AndroidBatchResult<void>>> {
    return this.runAll((device) => device.tap(x, y));
  }

  /** Swipe the same Android device pixel coordinates on every available device. */
  swipeAll(
    from: Point,
    to: Point,
    options?: { durationMs?: number }
  ): Promise<Array<AndroidBatchResult<void>>> {
    return this.runAll((device) => device.swipe(from, to, options));
  }

  /** Capture screenshots from every available device. */
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
            code: errorCode(error),
          };
        }
      })
    );
  }
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}
