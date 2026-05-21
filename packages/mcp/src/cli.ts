#!/usr/bin/env node
import { runSpotterMcp } from "./server.js";

runSpotterMcp().catch((err) => {
  console.error(err);
  process.exit(1);
});
