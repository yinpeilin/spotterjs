import { runAdb } from "./adb";
import type { AndroidNetworkOptions, AndroidPairTcpOptions } from "./types";

export function endpoint(host: string, port: number): string {
  return `${host}:${port}`;
}

export async function pairTcp(options: AndroidPairTcpOptions): Promise<void> {
  await runAdb(
    ["pair", endpoint(options.host, options.port), options.code],
    options
  );
}

export async function connectNetworkRaw(
  options: AndroidNetworkOptions
): Promise<string> {
  const serial = endpoint(options.host, options.port);
  await runAdb(["connect", serial], options);
  return serial;
}
