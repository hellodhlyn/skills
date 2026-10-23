import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateStatus } from "./session-dashboard/journal.mjs";

export function writeSessionStatus(sessionDir, checkpoint) {
  const validation = validateStatus(checkpoint);
  if (!validation.ok) throw new Error(`Invalid checkpoint: ${validation.error}`);
  const json = `${JSON.stringify(validation.value, null, 2)}\n`;
  const destination = path.resolve(sessionDir, "status.json");
  // The same-filesystem rename publishes a whole checkpoint without merging stale fields.
  const temporary = mkdtempSync(path.join(path.dirname(destination), ".status-"));
  try {
    const file = path.join(temporary, "status.json");
    writeFileSync(file, json, { mode: 0o600 });
    renameSync(file, destination);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  return destination;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [sessionDir, input, ...extra] = process.argv.slice(2);
  if (!sessionDir || !input || extra.length) {
    console.error("Usage: node write-session-status.mjs <session-dir> <checkpoint-json | ->");
    process.exitCode = 2;
  } else {
    try {
      const checkpoint = JSON.parse(readFileSync(input === "-" ? 0 : input, "utf8"));
      console.log(writeSessionStatus(sessionDir, checkpoint));
    } catch (error) {
      console.error(`ERROR: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
