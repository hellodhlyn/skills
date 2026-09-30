import assert from "node:assert/strict";
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const runner = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../run-codex-review.mjs");

function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "codex-review-test-")));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, "bin");
  const workdir = path.join(root, "repo");
  fs.mkdirSync(bin);
  fs.mkdirSync(workdir);
  const prompt = path.join(root, "request.md");
  fs.writeFileSync(prompt, "independent review request\n");
  fs.writeFileSync(path.join(bin, "codex"), `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.writeFileSync(process.env.REVIEW_TEST_ARGS, JSON.stringify(args));
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  fs.writeFileSync(process.env.REVIEW_TEST_INPUT, input);
  const mode = process.env.REVIEW_TEST_MODE;
  if (mode === 'cancel') {
    process.on('SIGTERM', () => { fs.writeFileSync(process.env.REVIEW_TEST_STOPPED, 'stopped'); process.exit(0); });
    console.log(JSON.stringify({type:'thread.started', thread_id:'active-thread'}));
    fs.writeFileSync(process.env.REVIEW_TEST_READY, 'ready');
    setInterval(() => {}, 1000);
    return;
  }
  if (mode !== 'empty') fs.writeFileSync(args[args.indexOf('-o') + 1], 'No actionable findings.\\n');
  console.log(JSON.stringify({type:'thread.started', thread_id:'review-thread'}));
  if (mode === 'error') { console.error('model access failed'); process.exitCode = 7; return; }
  if (mode === 'failed-event') console.log(JSON.stringify({type:'turn.failed'}));
  if (mode !== 'partial') console.log(JSON.stringify({type:'turn.completed', usage:{input_tokens:42}}));
});
`, { mode: 0o755 });
  const run = path.join(root, "round-1");
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`,
    REVIEW_TEST_ARGS: path.join(root, "argv.json"), REVIEW_TEST_INPUT: path.join(root, "stdin.txt"),
    REVIEW_TEST_READY: path.join(root, "ready"), REVIEW_TEST_STOPPED: path.join(root, "stopped") };
  const execute = (mode = "success", destination = run) => spawnSync(process.execPath,
    [runner, workdir, prompt, destination, "gpt-6-astra", "high"], {
      encoding: "utf8", timeout: 10000,
      env: { ...env, REVIEW_TEST_MODE: mode },
    });
  return { root, workdir, run, prompt, env, execute };
}

test("starts isolated read-only analysis and preserves its terminal evidence", (t) => {
  const f = fixture(t);
  const child = f.execute();
  assert.equal(child.status, 0, child.stderr);
  const args = JSON.parse(fs.readFileSync(path.join(f.root, "argv.json"), "utf8"));
  for (const flag of ["--ignore-user-config", "--ignore-rules", "--ephemeral", "--json"]) assert.ok(args.includes(flag));
  assert.equal(args[args.indexOf("-s") + 1], "read-only");
  assert.equal(args[args.indexOf("-m") + 1], "gpt-6-astra");
  for (const value of ['approval_policy="never"', 'web_search="disabled"', 'model_provider="openai"', 'model_reasoning_effort="high"']) assert.ok(args.includes(value));
  assert.deepEqual(args.slice(args.indexOf("--disable"), args.indexOf("--disable") + 2), ["--disable", "multi_agent"]);
  assert.equal(fs.readFileSync(path.join(f.root, "stdin.txt"), "utf8"), "independent review request\n");
  const evidence = JSON.parse(fs.readFileSync(path.join(f.run, "execution.json"), "utf8"));
  assert.equal(evidence.threadId, "review-thread");
  assert.equal(evidence.exitCode, 0);
  assert.equal(evidence.usage.input_tokens, 42);
  assert.equal(fs.readFileSync(path.join(f.run, "exit-code"), "utf8"), "0\n");
});

test("a model access failure preserves its exit and never publishes partial advice", (t) => {
  const f = fixture(t);
  const child = f.execute("error");
  assert.equal(child.status, 7);
  assert.equal(child.stdout, "");
  assert.match(fs.readFileSync(path.join(f.run, "stderr.log"), "utf8"), /model access failed/);
  assert.equal(fs.readFileSync(path.join(f.run, "exit-code"), "utf8"), "7\n");
});

for (const mode of ["partial", "empty", "failed-event"]) {
  test(`rejects ${mode} output despite a zero process exit`, (t) => {
    const f = fixture(t);
    const child = f.execute(mode);
    assert.equal(child.status, 3);
    assert.equal(child.stdout, "");
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.run, "execution.json"), "utf8")).cliExitCode, 0);
  });
}

test("refuses reused run directories and artifacts inside the inspected repository", (t) => {
  const f = fixture(t);
  fs.mkdirSync(f.run);
  fs.writeFileSync(path.join(f.run, "result.md"), "preserve prior review");
  assert.equal(f.execute().status, 1);
  assert.equal(fs.readFileSync(path.join(f.run, "result.md"), "utf8"), "preserve prior review");
  assert.equal(f.execute("success", path.join(f.workdir, "round")).status, 1);
  assert.equal(fs.existsSync(path.join(f.root, "argv.json")), false);
});

for (const [signal, expected] of [["SIGTERM", 143], ["SIGINT", 130]]) {
  test(`${signal} stops the child and preserves interrupted evidence`, async (t) => {
    const f = fixture(t);
    const child = spawn(process.execPath, [runner, f.workdir, f.prompt, f.run, "gpt-6-astra", "high"],
      { env: { ...f.env, REVIEW_TEST_MODE: "cancel" }, stdio: "ignore" });
    t.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
    const done = new Promise((resolve) => child.once("close", resolve));
    const deadline = Date.now() + 5000;
    while (!fs.existsSync(f.env.REVIEW_TEST_READY) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(fs.existsSync(f.env.REVIEW_TEST_READY));
    const active = JSON.parse(fs.readFileSync(path.join(f.run, "execution.json"), "utf8"));
    assert.equal(active.status, "running");
    assert.ok(active.childPid > 0);
    assert.match(fs.readFileSync(path.join(f.run, "events.jsonl"), "utf8"), /active-thread/);
    child.kill(signal);
    assert.equal(await done, expected);
    assert.equal(fs.readFileSync(f.env.REVIEW_TEST_STOPPED, "utf8"), "stopped");
    assert.equal(fs.readFileSync(path.join(f.run, "exit-code"), "utf8"), `${expected}\n`);
    const evidence = JSON.parse(fs.readFileSync(path.join(f.run, "execution.json"), "utf8"));
    assert.equal(evidence.status, "failed");
    assert.equal(evidence.signal, signal);
    assert.throws(() => process.kill(active.childPid, 0), { code: "ESRCH" });
  });
}
