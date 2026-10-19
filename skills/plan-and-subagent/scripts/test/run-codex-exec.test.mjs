import assert from "node:assert/strict";
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const runner = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../run-codex-exec.sh");

function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "codex-exec-test-")));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const workdir = path.join(root, "repo");
  const run = path.join(root, "run-1");
  fs.mkdirSync(workdir);
  fs.mkdirSync(run);
  fs.writeFileSync(path.join(run, "prompt.md"), "implement the brief\n");
  const instructions = path.join(root, "implementer.md");
  fs.writeFileSync(instructions, "implementer instructions\n");
  const pinned = path.join(root, "pinned-codex");
  fs.writeFileSync(pinned, `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.writeFileSync(${JSON.stringify(path.join(root, "argv.json"))}, JSON.stringify(args));
process.stdin.resume();
process.stdin.on('end', () => {
  fs.writeFileSync(args[args.indexOf('-o') + 1], 'done\\n');
  console.log(JSON.stringify({type:'thread.started', thread_id:'impl-thread'}));
});
`, { mode: 0o755 });
  return { root, workdir, run, instructions, pinned };
}

test("start runs the CLI named by CODEX_BIN", (t) => {
  const f = fixture(t);
  const child = spawnSync("sh", [runner, "start", f.workdir, f.instructions, f.run, "gpt-6-luna", "xhigh"], {
    encoding: "utf8", timeout: 10000, env: { ...process.env, PATH: "/usr/bin:/bin", CODEX_BIN: f.pinned },
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(fs.readFileSync(path.join(f.run, "thread-id"), "utf8").trim(), "impl-thread");
  const args = JSON.parse(fs.readFileSync(path.join(f.root, "argv.json"), "utf8"));
  assert.equal(args[args.indexOf("-s") + 1], "workspace-write");
});

test("a missing CODEX_BIN fails before running", (t) => {
  const f = fixture(t);
  const child = spawnSync("sh", [runner, "start", f.workdir, f.instructions, f.run, "gpt-6-luna", "xhigh"], {
    encoding: "utf8", timeout: 10000, env: { ...process.env, CODEX_BIN: path.join(f.root, "absent") },
  });
  assert.equal(child.status, 127);
  assert.equal(fs.existsSync(path.join(f.run, "events.jsonl")), false);
});
