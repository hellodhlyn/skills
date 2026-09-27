import assert from "node:assert/strict";
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const runner = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../run-opencode-review.sh");

function fixture(t, fakeBody) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "opencode-review-test-")));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const bin = path.join(directory, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "opencode"), `#!/bin/sh\necho "$@" > "${directory}/args"\n${fakeBody}\n`, { mode: 0o755 });
  const prompt = path.join(directory, "prompt.md");
  fs.writeFileSync(prompt, "review this\n");
  const result = path.join(directory, "review/result.md");
  const stderrLog = path.join(directory, "review/stderr.log");
  const run = (env = {}) => {
    const started = Date.now();
    const child = spawnSync("sh", [runner, directory, prompt, result, stderrLog], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, OPENCODE_REVIEW_IDLE_TIMEOUT: "2", OPENCODE_REVIEW_POLL_INTERVAL: "1", ...env },
      timeout: 30_000,
    });
    return { ...child, seconds: (Date.now() - started) / 1000 };
  };
  return { directory, result, stderrLog, run };
}

const logLine = (message) => `echo 'timestamp=2026-01-01T00:00:00.000Z level=INFO run=abc message=${message} x=1' >&2`;

test("captures the report and passes progress logging to opencode", (t) => {
  const { directory, result, stderrLog, run } = fixture(t, `${logLine("stream")}\necho "no actionable concern"`);
  const child = run();
  assert.equal(child.status, 0, child.stderr);
  assert.equal(fs.readFileSync(result, "utf8"), "no actionable concern\n");
  assert.match(fs.readFileSync(stderrLog, "utf8"), /message=stream/);
  assert.match(fs.readFileSync(path.join(directory, "args"), "utf8"), /--print-logs --log-level INFO/);
  assert.ok(child.seconds < 5, `completion took ${child.seconds}s`);
});

test("preserves a nonzero opencode exit status", (t) => {
  const { run } = fixture(t, "exit 3");
  assert.equal(run().status, 3);
});

test("stops a stalled review with status 124", (t) => {
  const { stderrLog, run } = fixture(t, `${logLine("stream")}\nsleep 60`);
  const child = run();
  assert.equal(child.status, 124);
  assert.match(child.stderr, /no progress for 2s/);
  assert.match(fs.readFileSync(stderrLog, "utf8"), /stopped as stalled/);
  assert.ok(child.seconds < 20, `watchdog took ${child.seconds}s`);
});

test("does not count periodic housekeeping logs as progress", (t) => {
  const { run } = fixture(t, `while :; do ${logLine("cleanup")}; ${logLine('"watcher backend"')}; sleep 0.5; done`);
  assert.equal(run().status, 124);
});

test("keeps a review alive while it logs progress", (t) => {
  const { run } = fixture(t, `for i in 1 2 3 4 5 6 7 8; do ${logLine("process")}; sleep 0.5; done\necho done`);
  const child = run();
  assert.equal(child.status, 0, child.stderr);
});
