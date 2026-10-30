/** Requires a paired protocol-v2 companion; reads state only and always closes. */
import { android } from "@spotterjs/plugin-android";

async function main() {
  const url = process.env.SPOTTERJS_ANDROID_URL;
  const sessionToken = process.env.SPOTTERJS_ANDROID_TOKEN;
  if (!url || !sessionToken) throw new Error("Set SPOTTERJS_ANDROID_URL and SPOTTERJS_ANDROID_TOKEN from your paired companion.");
  const device = await android.connect({ url, sessionToken, timeoutMs: 5000 });
  try {
    const display = await device.getDisplayInfo();
    const app = await device.currentApp();
    console.log(JSON.stringify({ display, app }));
  } finally {
    device.close();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
