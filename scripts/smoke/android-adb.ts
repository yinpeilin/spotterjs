import { android } from "@spotterjs/plugin-android-adb";

async function main() {
  const serial = process.env.SPOTTERJS_ANDROID_SERIAL;
  if (!serial) {
    console.log("skip: set SPOTTERJS_ANDROID_SERIAL to run Android ADB smoke");
    return;
  }

  const phone = await android.connect({
    serial,
    adbPath: process.env.SPOTTERJS_ADB_PATH,
  });
  const info = await phone.getInfo();
  const capture = await phone.capture();

  console.log(
    JSON.stringify(
      {
        serial: info.serial,
        state: info.state,
        model: info.model,
        capture: { width: capture.width, height: capture.height },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
