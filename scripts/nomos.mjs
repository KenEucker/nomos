import path from "node:path";
import { syncAdminUiFromNomosUi } from "./vendor/nomosUiSync.mjs";

function parseArgs(argv) {
  const args = [...argv];
  const flags = new Set();
  const positional = [];
  for (const arg of args) {
    if (arg.startsWith("--")) {
      flags.add(arg);
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

async function run() {
  const [, , ...rest] = process.argv;
  const { flags, positional } = parseArgs(rest);
  const command = positional[0];

  if (command === "sync") {
    const repoRoot = process.cwd();
    const noPrompt = flags.has("--no-prompt");
    await syncAdminUiFromNomosUi({ repoRoot, noPrompt });
    return;
  }

  const scriptName = path.basename(process.argv[1] ?? "nomos");
  console.error(`Usage: ${scriptName} sync [--no-prompt]`);
  process.exitCode = 1;
}

run().catch((error) => {
  console.error(`[nomos sync] ${error.message}`);
  process.exitCode = 1;
});
