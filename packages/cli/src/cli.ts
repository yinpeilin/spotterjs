#!/usr/bin/env node
import { runCli } from "./runner.js";

const controller = new AbortController();
const cancel = () => controller.abort(new Error("Command cancelled"));
process.on("SIGINT", cancel);
process.on("SIGTERM", cancel);
try {
  process.exitCode = await runCli(process.argv.slice(2), undefined, {}, controller.signal);
} finally {
  process.off("SIGINT", cancel);
  process.off("SIGTERM", cancel);
}
