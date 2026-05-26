import { runAdb } from "./adb";
import type {
  AndroidDeviceConnection,
  AndroidDeviceInfo,
  AndroidDeviceState,
  AndroidOptions,
} from "./types";

/** Parse `adb devices -l` output into normalized device metadata. */
export function parseAdbDevices(output: string): AndroidDeviceInfo[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("List of devices"))
    .map((line) => {
      const parts = line.split(/\s+/);
      const serial = parts[0];
      const state = normalizeState(parts[1]);
      const info: AndroidDeviceInfo = {
        serial,
        state,
        connection: inferConnection(serial),
      };

      for (const part of parts.slice(2)) {
        const [key, value] = part.split(":", 2);
        if (!value) continue;
        if (key === "model") info.model = value;
        if (key === "product") info.product = value;
        if (key === "transport_id") info.transportId = value;
      }

      return info;
    });
}

/** Discover Android devices currently visible to adb. */
export async function discoverDevices(
  options?: AndroidOptions
): Promise<AndroidDeviceInfo[]> {
  const stdout = (await runAdb(["devices", "-l"], options)) as string;
  return parseAdbDevices(stdout);
}

function inferConnection(serial: string): AndroidDeviceConnection {
  if (serial.startsWith("emulator-")) return "emulator";
  if (/^[^:]+:\d+$/.test(serial)) return "network";
  return "usb";
}

function normalizeState(state: string | undefined): AndroidDeviceState {
  if (state === "device" || state === "offline" || state === "unauthorized") {
    return state;
  }
  return "unknown";
}
