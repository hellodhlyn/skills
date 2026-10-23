import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { readStatus } from "../session-dashboard/journal.mjs";
import { writeSessionStatus } from "../write-session-status.mjs";

const CLI = fileURLToPath(new URL("../write-session-status.mjs", import.meta.url));
const checkpoint = {
  schema: 1,
  updatedAt: "2026-10-24T02:00:00.000Z",
  stage: 7,
  waitingOn: "none",
  summary: "Delivery complete",
};

function session(t) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "write-session-status-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(path.join(directory, "session.md"), "# Task\n");
  return directory;
}

test("publishes a complete checkpoint accepted by the dashboard and removes stale optional state", (t) => {
  const directory = session(t);
  writeSessionStatus(directory, {
    ...checkpoint, stage: 5, waitingOn: "user", summary: "Review result",
    userDecision: { question: "Accept?", options: ["Yes", "No"] },
    activeRuns: [{ runDir: "reviews/one", agent: "reviewer", role: "review", startedAt: checkpoint.updatedAt }],
  });
  assert.equal(writeSessionStatus(directory, checkpoint), path.join(directory, "status.json"));
  assert.deepEqual(readStatus(directory), { kind: "valid", value: checkpoint });
  assert.deepEqual(readdirSync(directory).sort(), ["session.md", "status.json"]);
  assert.equal(readFileSync(path.join(directory, "session.md"), "utf8"), "# Task\n");
});

test("invalid snapshots leave the previous checkpoint and directory unchanged", (t) => {
  const directory = session(t);
  const previous = '{"preserve":"existing bytes"}\n';
  writeFileSync(path.join(directory, "status.json"), previous);
  for (const input of [
    null,
    { ...checkpoint, stage: "delivered" },
    { ...checkpoint, waitingOn: "user-result-confirmation" },
    { ...checkpoint, updatedAt: "yesterday" },
    { ...checkpoint, summary: " " },
    { ...checkpoint, focus: [{ path: "../outside" }] },
  ]) {
    assert.throws(() => writeSessionStatus(directory, input), /Invalid checkpoint/);
    assert.equal(readFileSync(path.join(directory, "status.json"), "utf8"), previous);
    assert.deepEqual(readdirSync(directory).sort(), ["session.md", "status.json"]);
  }
});

test("failed publication cleans temporary files without deleting an existing destination", (t) => {
  const directory = session(t);
  mkdirSync(path.join(directory, "status.json"));
  writeFileSync(path.join(directory, "status.json", "keep"), "untouched");
  assert.throws(() => writeSessionStatus(directory, checkpoint));
  assert.equal(readFileSync(path.join(directory, "status.json", "keep"), "utf8"), "untouched");
  assert.deepEqual(readdirSync(directory).sort(), ["session.md", "status.json"]);
});

test("CLI accepts a file or stdin and rejects malformed JSON without replacing status", (t) => {
  const directory = session(t);
  const inputFile = path.join(directory, "checkpoint.json");
  writeFileSync(inputFile, JSON.stringify(checkpoint));
  const fromFile = spawnSync(process.execPath, [CLI, directory, inputFile], { encoding: "utf8" });
  assert.equal(fromFile.status, 0, fromFile.stderr);
  assert.deepEqual(readStatus(directory).value, checkpoint);

  const next = { ...checkpoint, summary: "Await user delivery decision", waitingOn: "user" };
  const fromStdin = spawnSync(process.execPath, [CLI, directory, "-"], { input: JSON.stringify(next), encoding: "utf8" });
  assert.equal(fromStdin.status, 0, fromStdin.stderr);
  assert.deepEqual(readStatus(directory).value, next);
  const before = readFileSync(path.join(directory, "status.json"), "utf8");
  const malformed = spawnSync(process.execPath, [CLI, directory, "-"], { input: "{", encoding: "utf8" });
  assert.equal(malformed.status, 1);
  assert.match(malformed.stderr, /ERROR:/);
  assert.equal(readFileSync(path.join(directory, "status.json"), "utf8"), before);
  assert.ok(readdirSync(directory).every((name) => !name.startsWith(".status-")));
});

test("CLI reports usage errors and requires an existing session directory", (t) => {
  const directory = session(t);
  const usage = spawnSync(process.execPath, [CLI], { encoding: "utf8" });
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /Usage:/);
  const missing = spawnSync(process.execPath, [CLI, path.join(directory, "missing"), "-"], { input: JSON.stringify(checkpoint), encoding: "utf8" });
  assert.equal(missing.status, 1);
  assert.deepEqual(readdirSync(directory), ["session.md"]);
});
