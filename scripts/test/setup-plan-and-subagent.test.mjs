import assert from "node:assert/strict";
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { applyPlan, assertSafeDestination, buildPlan, command, loadReceipt, missingLinks, parseArguments, resolveRoots } from "../lib/setup-plan-and-subagent.mjs";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = path.join(repository, "scripts/lib/setup-plan-and-subagent.mjs");

function fixture(t) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "agent-setup-test-")));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const repo = path.join(directory, "repo");
  fs.mkdirSync(repo);
  const roots = Object.fromEntries(["codex", "environment", "opencode", "pi", "state"].map((name) => [name, path.join(directory, name)]));
  const receiptPath = path.join(roots.state, "receipt.json");
  const receipt = loadReceipt(receiptPath);
  const manifest = { entries: [
    { component: "environment", root: "environment", source: "a.md", target: "a.md" },
    { component: "environment", root: "environment", source: "b.md", target: "nested/b.md" },
  ] };
  fs.writeFileSync(path.join(repo, "a.md"), "first version\n");
  fs.writeFileSync(path.join(repo, "b.md"), "second file\n");
  const plan = () => buildPlan(manifest, repo, roots, loadReceipt(receiptPath), ["environment"]);
  return { directory, repo, roots, receiptPath, receipt, manifest, plan };
}

test("requires an explicit operation and rejects contradictory flags", () => {
  for (const args of [[], ["--apply", "--check"], ["--force"], ["--check", "--force"], ["--apply", "--component", "bogus"]]) {
    assert.throws(() => parseArguments(args));
  }
  assert.equal(parseArguments(["--apply", "--force"]).force, true);
  assert.throws(() => resolveRoots({ PI_UI_VERIFIER_DIR: "relative" }, "/home/test"));
});

test("a timed-out command cannot pass by exiting zero on termination", async () => {
  const result = await command(process.execPath, ["-e", "process.on('SIGTERM',()=>process.exit(0)); setInterval(()=>{},1000);"], { timeout: 150 });
  assert.equal(result.timedOut, true);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /timed out/);
});

test("one late conflict prevents every destination write", (t) => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.roots.environment, "nested"), { recursive: true });
  const conflicting = path.join(f.roots.environment, "nested/b.md");
  fs.writeFileSync(conflicting, "user-owned\n");
  assert.throws(() => applyPlan(f.plan(), f.receipt, f.receiptPath), /Conflicts/);
  assert.equal(fs.existsSync(path.join(f.roots.environment, "a.md")), false);
  assert.equal(fs.existsSync(f.receiptPath), false);
  assert.equal(fs.readFileSync(conflicting, "utf8"), "user-owned\n");
});

test("missing source is detected before creating installation state", (t) => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.repo, "b.md"));
  assert.throws(f.plan, /Missing source/);
  assert.equal(fs.existsSync(f.roots.environment), false);
  assert.equal(fs.existsSync(f.roots.state), false);
});

test("managed updates are automatic, local edits conflict, unchanged files keep timestamps", (t) => {
  const f = fixture(t);
  applyPlan(f.plan(), f.receipt, f.receiptPath);
  const destination = path.join(f.roots.environment, "a.md");
  const before = fs.statSync(destination).mtimeMs;
  assert.ok(f.plan().files.every((entry) => entry.action === "unchanged"));
  applyPlan(f.plan(), loadReceipt(f.receiptPath), f.receiptPath);
  assert.equal(fs.statSync(destination).mtimeMs, before);
  fs.writeFileSync(path.join(f.repo, "a.md"), "upstream update\n");
  assert.equal(f.plan().files[0].action, "update");
  applyPlan(f.plan(), loadReceipt(f.receiptPath), f.receiptPath);
  assert.equal(fs.readFileSync(destination, "utf8"), "upstream update\n");
  fs.writeFileSync(destination, "local custom edit\n");
  assert.equal(f.plan().files[0].action, "conflict");
  assert.throws(() => applyPlan(f.plan(), loadReceipt(f.receiptPath), f.receiptPath));
  applyPlan(f.plan(), loadReceipt(f.receiptPath), f.receiptPath, true);
  assert.equal(fs.readFileSync(destination, "utf8"), "upstream update\n");
});

test("changed files between planning and apply are not overwritten even with force", (t) => {
  const f = fixture(t);
  applyPlan(f.plan(), f.receipt, f.receiptPath);
  fs.writeFileSync(path.join(f.repo, "a.md"), "upstream\n");
  const plan = f.plan();
  fs.writeFileSync(path.join(f.roots.environment, "a.md"), "new user edit\n");
  assert.throws(() => applyPlan(plan, loadReceipt(f.receiptPath), f.receiptPath, true), /changed during setup/);
});

test("unmanaged and retired files survive updates and remain reported", (t) => {
  const f = fixture(t);
  applyPlan(f.plan(), f.receipt, f.receiptPath);
  f.manifest.entries.pop();
  const extra = path.join(f.roots.environment, "personal.md");
  fs.writeFileSync(extra, "personal content");
  const plan = f.plan();
  assert.deepEqual(plan.stale, [path.join(f.roots.environment, "nested/b.md")]);
  applyPlan(plan, loadReceipt(f.receiptPath), f.receiptPath);
  assert.equal(fs.readFileSync(extra, "utf8"), "personal content");
  assert.equal(fs.existsSync(plan.stale[0]), true);
});

test("symlink targets and parents cannot be overwritten with force", (t) => {
  const f = fixture(t);
  fs.mkdirSync(f.roots.environment);
  const original = path.join(f.repo, "a.md");
  const target = path.join(f.roots.environment, "a.md");
  fs.symlinkSync(original, target);
  assert.throws(f.plan, /non-regular destination/);
  fs.unlinkSync(target);
  fs.symlinkSync(f.repo, path.join(f.roots.environment, "nested"));
  assert.throws(f.plan, /symlink parent/);
  assert.throws(() => assertSafeDestination(path.join(f.roots.environment, "nested/file")));
});

test("invalid receipts, duplicate targets, and repository destinations fail closed", (t) => {
  const f = fixture(t);
  fs.mkdirSync(f.roots.state);
  fs.writeFileSync(f.receiptPath, '{"version":1,"files":{"relative":{}}}');
  assert.throws(() => loadReceipt(f.receiptPath), /Invalid installation receipt/);
  const empty = { version: 1, files: {} };
  f.manifest.entries.push(f.manifest.entries[0]);
  assert.throws(() => buildPlan(f.manifest, f.repo, f.roots, empty, ["environment"]), /Duplicate/);
  assert.throws(() => buildPlan(f.manifest, f.repo, { ...f.roots, environment: f.repo }, empty, ["environment"]), /overlaps repository/);
});

test("broken relative documentation links are caught", (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.repo, "a.md"), "[procedure](missing.md#step) [external](https://example.com) [local](#step)");
  assert.equal(missingLinks(f.plan().files, true).length, 1);
  assert.equal(missingLinks(f.plan().files).length, 2);
});

test("a source link existing outside the install inventory cannot be silently omitted", (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.repo, "a.md"), "[procedure](extra.md)");
  fs.writeFileSync(path.join(f.repo, "extra.md"), "required procedure");
  const plan = f.plan();
  assert.equal(missingLinks(plan.files, true).length, 0);
  assert.equal(missingLinks(plan.files, true, true).length, 1);
});

function fakeCommands(f) {
  const bin = path.join(f.directory, "bin");
  fs.mkdirSync(bin);
  // External installers are simulated, but the real CLI, inventory, copies, receipts,
  // phase ordering and exit status are exercised in a disposable destination.
  const program = `#!${process.execPath}
import * as fs from 'node:fs';
import path from 'node:path';
const args=process.argv.slice(2);
fs.appendFileSync(process.env.SETUP_TEST_LOG, JSON.stringify([path.basename(process.argv[1]),...args])+'\\n');
if(path.basename(process.argv[1])==='gh') {
  fs.cpSync(path.join(args[2],'skills',args[3]),path.join(args[args.indexOf('--dir')+1],args[3]),{recursive:true});
} else if(args.includes('--version')) {console.log('test-version');}
else if(args.includes('agent')) {console.log('reviewer (primary)');}
else if(args.includes('auth')) {
  if(process.env.SETUP_TEST_BAD_AUTH) {console.log('private-auth-output');process.exitCode=1;}
  else if(process.env.SETUP_TEST_MISSING_AUTH) {console.log(JSON.stringify({status:'not_ready',provider:'opencode-go',reason:'credentials_not_configured'}));process.exitCode=1;}
  else console.log(JSON.stringify({status:'ready',provider:'opencode-go'}));
} else if(args.includes('install') && process.env.SETUP_TEST_FAIL_INSTALL) {console.error('fixture dependency failure');process.exitCode=1;}
else if(args.includes('-e') && process.env.SETUP_TEST_FAIL_BROWSER) {console.error('fixture browser failure');process.exitCode=1;}
`;
  for (const name of ["gh", "mise"]) fs.writeFileSync(path.join(bin, name), program, { mode: 0o755 });
  const log = path.join(f.directory, "commands.jsonl");
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`,
    PLAN_AND_SUBAGENT_CODEX_DIR: f.roots.codex,
    AGENT_ENVIRONMENT_DIR: f.roots.environment, OPENCODE_CONFIG_DIR: f.roots.opencode,
    PI_UI_VERIFIER_DIR: f.roots.pi, PLAN_AND_SUBAGENT_SETUP_DIR: f.roots.state,
    SETUP_TEST_LOG: log,
  };
  fs.mkdirSync(f.roots.codex);
  fs.writeFileSync(path.join(f.roots.codex, "AGENTS.md"), `Read ${path.join(f.roots.environment, "plan-and-subagent.md")} when running plan-and-subagent.`);
  const run = (args, overrides = {}) => spawnSync(process.execPath, [cli, ...args], { env: { ...env, ...overrides }, encoding: "utf8", timeout: 15_000 });
  const calls = () => fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").map(JSON.parse) : [];
  return { run, calls, env };
}

test("full dry-run writes no destinations; apply installs all components; repeat preserves files", (t) => {
  const f = fixture(t);
  const { run, calls } = fakeCommands(f);
  const dry = run(["--dry-run"]);
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(fs.existsSync(f.roots.environment), false);
  assert.equal(fs.existsSync(f.roots.state), false);
  assert.ok(calls().every((call) => call[0] === "gh"));
  const apply = run(["--apply"]);
  assert.equal(apply.status, 0, apply.stdout + apply.stderr);
  for (const file of [path.join(f.roots.codex, "skills/plan-and-subagent/SKILL.md"), path.join(f.roots.codex, "agents/luna_mockup.toml"), path.join(f.roots.environment, "plan-and-subagent/pi.md"), path.join(f.roots.opencode, "agents/reviewer.md"), path.join(f.roots.pi, "src/run.mjs")]) {
    assert.ok(fs.existsSync(file), file);
  }
  assert.ok(calls().some((call) => call.includes("chromium")));
  const repeated = run(["--apply"]);
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.doesNotMatch(repeated.stdout, /\[(ADD|UPDATE|CONFLICT)\]/);
  const receiptBefore = fs.readFileSync(f.receiptPath, "utf8");
  assert.equal(run(["--check"]).status, 0);
  assert.equal(fs.readFileSync(f.receiptPath, "utf8"), receiptBefore);
});

test("dependency failure retains progress and the same installation can resume", (t) => {
  const f = fixture(t);
  const { run } = fakeCommands(f);
  const failed = run(["--apply"], { SETUP_TEST_FAIL_INSTALL: "1" });
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /fixture dependency failure/);
  assert.ok(Object.keys(loadReceipt(f.receiptPath).files).length > 0);
  const resumed = run(["--apply"]);
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.doesNotMatch(resumed.stdout, /\[(ADD|UPDATE|CONFLICT)\]/);
});

test("missing authentication returns action-required; invalid auth is a failure without leaking output", (t) => {
  const f = fixture(t);
  const { run } = fakeCommands(f);
  const missing = run(["--apply"], { SETUP_TEST_MISSING_AUTH: "1" });
  assert.equal(missing.status, 2, missing.stdout + missing.stderr);
  assert.match(missing.stdout, /\[PASS\] File synchronization/);
  assert.match(missing.stdout, /\[ACTION_REQUIRED\] Pi authentication/);
  const invalid = run(["--check"], { SETUP_TEST_BAD_AUTH: "1" });
  assert.equal(invalid.status, 1);
  assert.doesNotMatch(invalid.stdout + invalid.stderr, /private-auth-output/);
});

test("browser failure is not hidden by passing package checks or missing auth", (t) => {
  const f = fixture(t);
  const { run } = fakeCommands(f);
  const failed = run(["--apply"], { SETUP_TEST_FAIL_BROWSER: "1", SETUP_TEST_MISSING_AUTH: "1" });
  assert.equal(failed.status, 1);
  assert.match(failed.stdout, /\[PASS\] Pi package checks/);
  assert.match(failed.stdout, /\[FAIL\] Chromium capture and audit/);
});

test("global instruction omission is reported without rewriting it; overrides take precedence", (t) => {
  const f = fixture(t);
  const { run } = fakeCommands(f);
  const override = path.join(f.roots.codex, "AGENTS.override.md");
  fs.writeFileSync(override, "Other instructions\n");
  const result = run(["--apply"]);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stdout, /\[ACTION_REQUIRED\] Global profile designation/);
  assert.equal(fs.readFileSync(override, "utf8"), "Other instructions\n");
});

test("component installer uses shared inventory and does not claim full readiness", (t) => {
  const f = fixture(t);
  const { env } = fakeCommands(f);
  // Run the actual compatibility wrapper; use real mise for its initial Node invocation.
  const result = spawnSync("bash", [path.join(repository, "scripts/install-agent-environment.sh")], {
    env: { ...env, PATH: process.env.PATH }, encoding: "utf8", timeout: 15_000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(f.roots.environment, "plan-and-subagent/pi.md")));
  assert.equal(fs.existsSync(path.join(f.roots.codex, "agents")), false);
  assert.match(result.stdout, /Component-only result/);
});
