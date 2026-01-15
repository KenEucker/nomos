#!/usr/bin/env node
import { scaffold } from "./scaffold";

const run = async () => {
  try {
    await scaffold({ targetDir: process.argv[2] });
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Unknown error");
    console.error(`\ncreate-nomos failed: ${err.message}`);
    process.exit(1);
  }
};

await run();
