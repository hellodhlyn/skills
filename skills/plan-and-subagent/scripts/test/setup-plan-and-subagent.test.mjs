import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { applyPlan, assertSafeDestination, buildPlan, checkLocalProfile, command, loadReceipt, missingLinks, parseArguments, profileHeadings, referencedProfiles, requiredProfileHeadings, resolveRoots } from "../lib/setup-plan-and-subagent.mjs";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const cli = path.join(repository, "skills/plan-and-subagent/scripts/lib/setup-plan-and-subagent.mjs");

function within(root, file) {
  const relative = path.relative(root, file);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function fixture(t) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "agent-setup-test-")));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const repo = path.join(directory, "repo");
  fs.mkdirSync(repo);
  const roots = Object.fromEntries(["codex", "claude", "environment", "opencode", "browser", "state"].map((name) => [name, path.join(directory, name)]));
  const receiptPath = path.join(roots.state, "receipt.json");
  const receipt = loadReceipt(receiptPath);
  const manifest = { entries: [
    { component: "skill", root: "environment", source: "a.md", target: "a.md" },
    { component: "skill", root: "environment", source: "b.md", target: "nested/b.md" },
  ] };
  fs.writeFileSync(path.join(repo, "a.md"), "first version\n");
  fs.writeFileSync(path.join(repo, "b.md"), "second file\n");
  const plan = () => buildPlan(manifest, repo, roots, loadReceipt(receiptPath), ["skill"]);
  return { directory, repo, roots, receiptPath, receipt, manifest, plan };
}

test("requires an explicit operation and rejects contradictory flags", () => {
  for (const args of [[], ["--apply", "--check"], ["--force"], ["--check", "--force"], ["--apply", "--component", "bogus"]]) {
    assert.throws(() => parseArguments(args));
  }
  assert.equal(parseArguments(["--apply", "--force"]).force, true);
  assert.equal(parseArguments(["--dry-run", "--profile", "codex"]).profile, "codex");
  assert.equal(parseArguments(["--dry-run", "--profile", "claude"]).profile, "claude");
  assert.throws(() => parseArguments(["--dry-run", "--profile", "glm"]));
  assert.throws(() => parseArguments(["--dry-run", "--profile", "both"]));
  assert.throws(() => parseArguments(["--dry-run", "--profile", "unknown"]));
  assert.throws(() => resolveRoots({ PLAN_AND_SUBAGENT_UI_BROWSER_DIR: "relative" }, "/home/test"));
  for (const component of ["skill", "environment", "opencode", "ui-browser"]) assert.equal(parseArguments(["--check", "--component", component]).component, component);
  assert.throws(() => parseArguments(["--check", "--component", "profile"]));
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
  f.manifest.retired = [{ component: "skill", root: "environment", target: "retired.md" }];
  const extra = path.join(f.roots.environment, "personal.md");
  const retired = path.join(f.roots.environment, "retired.md");
  fs.writeFileSync(extra, "personal content");
  fs.writeFileSync(retired, "legacy content");
  const plan = f.plan();
  assert.deepEqual(plan.stale, [path.join(f.roots.environment, "nested/b.md"), retired]);
  applyPlan(plan, loadReceipt(f.receiptPath), f.receiptPath);
  assert.equal(fs.readFileSync(extra, "utf8"), "personal content");
  assert.equal(fs.existsSync(plan.stale[0]), true);
  assert.equal(fs.readFileSync(retired, "utf8"), "legacy content");
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
  assert.throws(() => buildPlan(f.manifest, f.repo, f.roots, empty, ["skill"]), /Duplicate/);
  assert.throws(() => buildPlan(f.manifest, f.repo, { ...f.roots, environment: f.repo }, empty, ["skill"]), /overlaps repository/);
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

function completeProfile(omit = []) {
  return `# Profile\n\n${requiredProfileHeadings.filter((heading) => !omit.includes(heading)).map((heading) => `## ${heading}\n\ncontent\n`).join("\n")}`;
}

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
else if(args.includes('install') && process.env.SETUP_TEST_FAIL_INSTALL) {console.error('fixture dependency failure');process.exitCode=1;}
else if(args.includes('-e') && process.env.SETUP_TEST_FAIL_BROWSER) {console.error('fixture browser failure');process.exitCode=1;}
`;
  for (const name of ["gh", "pnpm", "node"]) fs.writeFileSync(path.join(bin, name), program, { mode: 0o755 });
  const log = path.join(f.directory, "commands.jsonl");
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`,
    PLAN_AND_SUBAGENT_CODEX_DIR: f.roots.codex,
    PLAN_AND_SUBAGENT_CLAUDE_DIR: f.roots.claude,
    AGENT_ENVIRONMENT_DIR: f.roots.environment, OPENCODE_CONFIG_DIR: f.roots.opencode,
    PLAN_AND_SUBAGENT_UI_BROWSER_DIR: f.roots.browser,
    PLAN_AND_SUBAGENT_SETUP_DIR: f.roots.state,
    SETUP_TEST_LOG: log,
  };
  // Local profiles are user-owned; the fixture stands in for them under a disposable directory.
  const profiles = { codex: path.join(f.directory, "local/codex/PROFILE.md"), claude: path.join(f.directory, "local/claude/PROFILE.md") };
  for (const file of Object.values(profiles)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, completeProfile());
  }
  fs.mkdirSync(f.roots.codex);
  fs.writeFileSync(path.join(f.roots.codex, "AGENTS.md"), `Read ${profiles.codex} when running plan-and-subagent.`);
  fs.mkdirSync(f.roots.claude);
  fs.writeFileSync(path.join(f.roots.claude, "CLAUDE.md"), `Read ${profiles.claude} when running plan-and-subagent.`);
  const run = (args, overrides = {}) => spawnSync(process.execPath, [cli, ...args], { env: { ...env, ...overrides }, encoding: "utf8", timeout: 15_000 });
  const calls = () => fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").map(JSON.parse) : [];
  return { run, calls, env, profiles };
}

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

test("browser failure is not hidden by passing package checks", (t) => {
  const f = fixture(t);
  const { run } = fakeCommands(f);
  const failed = run(["--apply"], { SETUP_TEST_FAIL_BROWSER: "1" });
  assert.equal(failed.status, 1);
  assert.match(failed.stdout, /\[PASS\] UI browser package/);
  assert.match(failed.stdout, /\[FAIL\] UI browser Chromium/);
});

test("the Claude runner scopes permissions, captures the report, and rejects mismatched sessions", (t) => {
  const f = fixture(t);
  const bin = path.join(f.directory, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "claude"), `#!${process.execPath}
import * as fs from 'node:fs';
const args=process.argv.slice(2);
const prompt=fs.readFileSync(0,'utf8');
fs.writeFileSync(process.env.RUNNER_TEST_LOG, JSON.stringify({args, cwd: process.cwd(), prompt}));
const resumed=args.includes('--resume');
console.log(JSON.stringify({type:'result', subtype: process.env.RUNNER_TEST_ERROR ? 'error_during_execution' : 'success', is_error: Boolean(process.env.RUNNER_TEST_ERROR),
  result:'design report', session_id: resumed ? (process.env.RUNNER_TEST_SESSION || args[args.indexOf('--resume')+1]) : 'session-1',
  modelUsage:{'fixture-model':{}}}));
`, { mode: 0o755 });
  const runner = path.join(repository, "skills/plan-and-subagent/scripts/run-claude-agent.sh");
  const log = path.join(f.directory, "claude.json");
  const workdir = path.join(f.directory, "product");
  const session = path.join(f.directory, "session");
  const mockups = path.join(session, "mockups");
  for (const directory of [workdir, mockups]) fs.mkdirSync(directory, { recursive: true });
  const runDir = (name) => {
    const directory = path.join(session, "reviews/uiux", name);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "prompt.md"), "handoff");
    return directory;
  };
  const run = (args, env = {}) => spawnSync("sh", [runner, ...args], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, RUNNER_TEST_LOG: log, ...env }, encoding: "utf8" });
  const read = (directory, name) => fs.readFileSync(path.join(directory, name), "utf8").trim();

  const design = runDir("run-1");
  let result = run(["start", workdir, session, design, "fixture-designer"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(read(design, "result.md"), "design report");
  assert.equal(read(design, "session-id"), "session-1");
  assert.equal(read(design, "models"), "fixture-model");
  assert.equal(read(design, "exit-code"), "0");
  let call = JSON.parse(fs.readFileSync(log, "utf8"));
  assert.equal(call.cwd, fs.realpathSync(workdir));
  assert.equal(call.prompt, "handoff");
  assert.deepEqual(call.args.slice(0, 7), ["-p", "--agent", "fixture-designer", "--output-format", "json", "--permission-mode", "dontAsk"]);
  assert.deepEqual(call.args.slice(call.args.indexOf("--add-dir") + 1, call.args.indexOf("--add-dir") + 3),
    [path.join(repository, "skills/plan-and-subagent"), fs.realpathSync(session)]);
  assert.equal(call.args.some((arg) => arg.startsWith("Edit(") || arg.includes("bypass") || arg === "--bare"), false);

  const mockup = runDir("run-2");
  result = run(["start", workdir, session, mockup, "fixture-designer", mockups]);
  assert.equal(result.status, 0, result.stderr);
  call = JSON.parse(fs.readFileSync(log, "utf8"));
  assert.ok(call.args.includes(`Edit(/${fs.realpathSync(mockups)}/**)`));

  const correction = runDir("run-3");
  assert.equal(run(["resume", workdir, session, correction, "fixture-designer", "session-1", mockups]).status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(log, "utf8")).args.slice(-2), ["--resume", "session-1"]);
  const mismatch = runDir("run-4");
  assert.equal(run(["resume", workdir, session, mismatch, "fixture-designer", "session-1"], { RUNNER_TEST_SESSION: "other" }).status, 3);
  assert.match(read(mismatch, "stderr.log"), /does not match/);
  const failed = runDir("run-5");
  assert.equal(run(["start", workdir, session, failed, "fixture-designer"], { RUNNER_TEST_ERROR: "1" }).status, 3);
  assert.equal(read(failed, "exit-code"), "3");

  assert.equal(run(["start", workdir, session, design, "fixture-designer"]).status, 2);
  assert.equal(run(["start", workdir, session, runDir("run-6"), "fixture-designer", session]).status, 2);
  assert.equal(run(["start", workdir, session, runDir("run-7"), "fixture-designer", workdir]).status, 2);
  const knowledge = path.join(f.directory, "knowledge");
  fs.mkdirSync(knowledge);
  const withKnowledge = runDir("run-8");
  assert.equal(run(["start", "--read-dir", knowledge, workdir, session, withKnowledge, "fixture-designer"]).status, 0);
  call = JSON.parse(fs.readFileSync(log, "utf8"));
  assert.deepEqual(call.args.slice(call.args.indexOf("--add-dir") + 1, call.args.indexOf("--allowedTools")),
    [path.join(repository, "skills/plan-and-subagent"), fs.realpathSync(session), fs.realpathSync(knowledge)]);
  assert.equal(call.args.some((arg) => arg.startsWith("Edit(")), false);
  assert.equal(run(["start", "--read-dir", "relative", workdir, session, runDir("run-9"), "fixture-designer"]).status, 2);
  assert.equal(run(["start", "--read-dir", path.join(f.directory, "missing"), workdir, session, runDir("run-10"), "fixture-designer"]).status, 2);
  const outside = path.join(f.directory, "outside");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "prompt.md"), "handoff");
  assert.equal(run(["start", workdir, session, outside, "fixture-designer"]).status, 2);
});

const realManifest = () => JSON.parse(fs.readFileSync(path.join(repository, "skills/plan-and-subagent/scripts/plan-and-subagent-install.json"), "utf8"));

test("the inventory installs only the skill and the UI browser, with no profile or agent definitions", (t) => {
  const f = fixture(t);
  const manifest = realManifest();
  assert.deepEqual([...new Set(manifest.entries.map((entry) => entry.component))].sort(), ["skill", "ui-browser"]);
  assert.equal(Object.hasOwn(manifest, "removeProfileFiles"), false);
  assert.ok(manifest.retired.every((entry) => entry.component === "skill-opencode"));
  assert.deepEqual(manifest.profiles, ["codex", "claude"]);
  for (const check of Object.values(manifest.checks)) {
    assert.deepEqual(Object.keys(check).sort(), ["designation", "session"]);
  }
  assert.doesNotMatch(JSON.stringify(manifest), /profiles\/|agents\/|gpt-|claude-(opus|haiku|sonnet)|PROFILE\.md/);
  for (const profile of ["codex", "claude"]) {
    const plan = buildPlan(manifest, repository, f.roots, f.receipt, ["skill", "skill-opencode", "ui-browser"], new Map(), [profile]);
    assert.deepEqual(missingLinks(plan.files, true), []);
    assert.deepEqual(missingLinks(plan.files, true, true), []);
    const targets = plan.files.map((entry) => entry.target);
    assert.ok(targets.includes(path.join(f.roots[profile], "skills/plan-and-subagent/SKILL.md")));
    assert.ok(targets.includes(path.join(f.roots.browser, "server.mjs")));
    assert.equal(targets.some((target) => within(f.roots.environment, target) || within(f.roots.opencode, target)), false);
    assert.equal(targets.some((target) => within(path.join(f.roots[profile], "agents"), target)), false);
  }
  assert.equal(fs.existsSync(path.join(repository, "profiles")), false);
});

test("the documented profile interface lists exactly the headings the installer requires", () => {
  const document = fs.readFileSync(path.join(repository, "skills/plan-and-subagent/references/profile-interface.md"), "utf8");
  const documented = profileHeadings(document);
  for (const heading of requiredProfileHeadings) assert.ok(documented.has(heading), heading);
  assert.equal(documented.size, requiredProfileHeadings.length);
  assert.doesNotMatch(document, /gpt-|claude-(opus|haiku|sonnet)|glm|\/Users\//i);
});

test("profile heading and path detection ignore fenced code and require absolute or home-relative paths", () => {
  const headings = profileHeadings("# T\n## Journal\n```md\n## Language\n```\n### Language\n## Language ##\n##Journal\n");
  assert.deepEqual([...headings].sort(), ["Journal", "Language"]);
  const text = "See `~/p/a/PROFILE.md`, /abs/b/PROFILE.md and (/abs/b/PROFILE.md) but not relative/PROFILE.md or x/abs/NOT-PROFILE.md.";
  assert.deepEqual(referencedProfiles(text, "/home/test"), ["/home/test/p/a/PROFILE.md", "/abs/b/PROFILE.md"]);
});

test("the local profile check reports a missing designation, file, and headings by name", (t) => {
  const f = fixture(t);
  fs.mkdirSync(f.roots.codex);
  const designation = path.join(f.roots.codex, "AGENTS.md");
  const check = { designation: { root: "codex", files: ["AGENTS.override.md", "AGENTS.md"] } };
  const results = [];
  const report = (name, status, detail) => results.push({ name, status, detail });
  checkLocalProfile(check, f.roots, report);
  assert.deepEqual(results.map((entry) => entry.status), ["ACTION_REQUIRED"]);
  assert.match(results[0].detail, /No absolute or ~-prefixed PROFILE\.md path/);

  results.length = 0;
  const home = path.join(f.directory, "home");
  const profile = path.join(home, "profiles/main/PROFILE.md");
  fs.writeFileSync(designation, "Read ~/profiles/main/PROFILE.md first.");
  checkLocalProfile(check, f.roots, report, home);
  assert.deepEqual(results.map((entry) => [entry.name, entry.status]), [["Global profile designation", "PASS"], ["Local profile interface", "ACTION_REQUIRED"]]);
  assert.match(results[1].detail, /missing or not a regular file/);
  assert.equal(fs.existsSync(profile), false);

  results.length = 0;
  fs.mkdirSync(path.dirname(profile), { recursive: true });
  fs.writeFileSync(profile, completeProfile(["Drift handling", "Language"]));
  checkLocalProfile(check, f.roots, report, home);
  assert.equal(results[1].status, "ACTION_REQUIRED");
  assert.match(results[1].detail, /missing H2 heading\(s\): Drift handling, Language\./);

  results.length = 0;
  fs.writeFileSync(profile, completeProfile());
  checkLocalProfile(check, f.roots, report, home);
  assert.deepEqual(results.map((entry) => entry.status), ["PASS", "PASS"]);
  // An override file takes precedence over AGENTS.md and is read instead of it.
  fs.writeFileSync(path.join(f.roots.codex, "AGENTS.override.md"), "No profile here.");
  results.length = 0;
  checkLocalProfile(check, f.roots, report, home);
  assert.deepEqual(results.map((entry) => entry.status), ["ACTION_REQUIRED"]);
});

test("full dry-run writes nothing; apply syncs only the skill and UI browser; the profile check passes", (t) => {
  const f = fixture(t);
  const { run, calls } = fakeCommands(f);
  const dry = run(["--dry-run"]);
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(fs.existsSync(f.roots.state), false);
  assert.ok(calls().every((call) => call[0] === "gh"));
  const apply = run(["--apply"]);
  assert.equal(apply.status, 0, apply.stdout + apply.stderr);
  for (const file of [path.join(f.roots.codex, "skills/plan-and-subagent/SKILL.md"), path.join(f.roots.codex, "skills/plan-and-subagent/references/profile-interface.md"), path.join(f.roots.browser, "server.mjs")]) {
    assert.ok(fs.existsSync(file), file);
  }
  for (const absent of [path.join(f.roots.codex, "agents"), path.join(f.roots.claude, "agents"), path.join(f.roots.claude, "skills"), f.roots.environment, f.roots.opencode]) {
    assert.equal(fs.existsSync(absent), false, absent);
  }
  assert.match(apply.stdout, /\[PASS\] Global profile designation/);
  assert.match(apply.stdout, /\[PASS\] Local profile interface/);
  assert.match(apply.stdout, /\[NOTICE\] Session/);
  assert.ok(calls().some((call) => call.includes("chromium")));
  const repeated = run(["--apply"]);
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.doesNotMatch(repeated.stdout, /\[(ADD|UPDATE|CONFLICT)\]/);
  const receiptBefore = fs.readFileSync(f.receiptPath, "utf8");
  assert.equal(run(["--check"]).status, 0);
  assert.equal(fs.readFileSync(f.receiptPath, "utf8"), receiptBefore);
  const claude = run(["--apply", "--profile", "claude"]);
  assert.equal(claude.status, 0, claude.stdout + claude.stderr);
  assert.ok(fs.existsSync(path.join(f.roots.claude, "skills/plan-and-subagent/SKILL.md")));
  assert.match(claude.stdout, /\[PASS\] Global profile designation: Profile path found in .*CLAUDE\.md/);
});

test("missing headings and a missing or undesignated profile need user action without editing anything", (t) => {
  const f = fixture(t);
  const { run, profiles } = fakeCommands(f);
  fs.writeFileSync(profiles.codex, completeProfile(["Project runbooks", "Journal"]));
  const incomplete = run(["--apply"]);
  assert.equal(incomplete.status, 2, incomplete.stdout + incomplete.stderr);
  assert.match(incomplete.stdout, /\[ACTION_REQUIRED\] Local profile interface: .*missing H2 heading\(s\): Project runbooks, Journal\./);
  assert.equal(fs.readFileSync(profiles.codex, "utf8"), completeProfile(["Project runbooks", "Journal"]));
  assert.ok(fs.existsSync(path.join(f.roots.codex, "skills/plan-and-subagent/SKILL.md")), "files are still installed");

  fs.rmSync(profiles.codex);
  const missing = run(["--check"]);
  assert.equal(missing.status, 2);
  assert.match(missing.stdout, /\[ACTION_REQUIRED\] Local profile interface: .*missing or not a regular file/);
  assert.equal(fs.existsSync(profiles.codex), false);

  const override = path.join(f.roots.codex, "AGENTS.override.md");
  fs.writeFileSync(override, "Other instructions\n");
  const undesignated = run(["--check"]);
  assert.equal(undesignated.status, 2, undesignated.stdout);
  assert.match(undesignated.stdout, /\[ACTION_REQUIRED\] Global profile designation/);
  assert.equal(fs.readFileSync(override, "utf8"), "Other instructions\n");

  fs.writeFileSync(path.join(f.roots.claude, "CLAUDE.md"), "Other instructions\n");
  const claude = run(["--apply", "--profile", "claude"]);
  assert.equal(claude.status, 2, claude.stdout + claude.stderr);
  assert.match(claude.stdout, /\[ACTION_REQUIRED\] Global profile designation/);
  assert.equal(fs.readFileSync(path.join(f.roots.claude, "CLAUDE.md"), "utf8"), "Other instructions\n");
});

test("receipt entries for profiles and agent definitions are released to local ownership and never removed", (t) => {
  const f = fixture(t);
  const { run } = fakeCommands(f);
  const hash = (contents) => createHash("sha256").update(contents).digest("hex");
  const local = [
    ["profile", path.join(f.roots.environment, "profiles/codex/PROFILE.md")],
    ["environment", path.join(f.roots.environment, "plan-and-subagent.md")],
    ["claude", path.join(f.roots.claude, "agents/claude-ui-ux-designer.md")],
    ["codex", path.join(f.roots.codex, "agents/implementer.toml")],
    ["opencode", path.join(f.roots.opencode, "agents/reviewer.md")],
  ];
  const receipt = { version: 1, files: {} };
  for (const [component, file] of local) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "my local customization");
    // The recorded hash differs from the file, and some entries even claim a profile ownership.
    receipt.files[file] = { component, profile: "codex", hash: hash("installed by an earlier version") };
  }
  const kept = path.join(f.roots.codex, "skills/plan-and-subagent/old.md");
  fs.mkdirSync(path.dirname(kept), { recursive: true });
  fs.writeFileSync(kept, "old skill file");
  receipt.files[kept] = { component: "skill", profile: "codex", hash: hash("old skill file") };
  fs.mkdirSync(f.roots.state, { recursive: true });
  fs.writeFileSync(f.receiptPath, JSON.stringify(receipt));

  const loaded = loadReceipt(f.receiptPath);
  assert.deepEqual(loaded.released.sort(), local.map(([, file]) => file).sort());
  assert.deepEqual(Object.keys(loaded.files), [kept]);
  assert.equal(Object.hasOwn(JSON.parse(JSON.stringify(loaded)), "released"), false);
  const plan = buildPlan(realManifest(), repository, f.roots, loaded, ["skill", "skill-opencode", "ui-browser"], new Map(), ["codex"]);
  assert.equal(plan.stale.some((file) => local.some(([, owned]) => owned === file)), false);

  const dry = run(["--dry-run"]);
  assert.equal(dry.status, 0, dry.stdout + dry.stderr);
  for (const [, file] of local) assert.ok(dry.stdout.includes(`[NOTICE] released to local ownership: ${file}`), file);
  assert.equal(JSON.parse(fs.readFileSync(f.receiptPath, "utf8")).files[local[0][1]].component, "profile", "dry-run does not rewrite the receipt");

  const apply = run(["--apply", "--force"]);
  assert.equal(apply.status, 0, apply.stdout + apply.stderr);
  for (const [, file] of local) {
    assert.ok(apply.stdout.includes(`[NOTICE] released to local ownership: ${file}`), file);
    assert.equal(fs.readFileSync(file, "utf8"), "my local customization");
  }
  assert.doesNotMatch(apply.stdout, /\[REMOVE\]/);
  const written = JSON.parse(fs.readFileSync(f.receiptPath, "utf8"));
  for (const [, file] of local) assert.equal(Object.hasOwn(written.files, file), false, file);
  assert.ok(Object.values(written.files).every((record) => ["skill", "ui-browser"].includes(record.component)));
  const repeated = run(["--apply"]);
  assert.equal(repeated.status, 0, repeated.stdout + repeated.stderr);
  assert.doesNotMatch(repeated.stdout, /released to local ownership/);
  for (const [, file] of local) assert.equal(fs.readFileSync(file, "utf8"), "my local customization");
});

test("local-only component wrappers print a notice, install nothing, and exit zero", (t) => {
  const f = fixture(t);
  const { env, run } = fakeCommands(f);
  const before = fs.readdirSync(f.directory).sort();
  for (const wrapper of ["install-agent-environment.sh", "install-opencode-agents.sh"]) {
    const result = spawnSync("bash", [path.join(repository, "skills/plan-and-subagent/scripts", wrapper)], { env, encoding: "utf8", timeout: 15_000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /local-only files now/);
    assert.equal(result.stdout.trim().split("\n").length, 1);
  }
  for (const component of ["environment", "opencode"]) {
    const result = run(["--apply", "--component", component]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /local-only files now/);
  }
  assert.deepEqual(fs.readdirSync(f.directory).sort(), before);
  assert.equal(fs.existsSync(f.roots.state), false);
  const skillOnly = run(["--apply", "--component", "skill"]);
  assert.equal(skillOnly.status, 0, skillOnly.stdout + skillOnly.stderr);
  assert.match(skillOnly.stdout, /Component-only result: skill/);
  assert.doesNotMatch(skillOnly.stdout, /Local profile interface/);
  assert.equal(fs.existsSync(path.join(f.roots.browser, "server.mjs")), false);
});

test("older receipts without profile ownership are not reported as obsolete for another profile", (t) => {
  const f = fixture(t);
  f.manifest.entries = [
    { component: "skill", profiles: ["codex"], root: "environment", source: "a.md", target: "codex-only/a.md" },
    { component: "skill", profile: "claude", root: "environment", source: "b.md", target: "claude/b.md" },
  ];
  const codexFile = path.join(f.roots.environment, "codex-only/a.md");
  const unknownFile = path.join(f.roots.environment, "unknown.md");
  fs.mkdirSync(path.dirname(codexFile), { recursive: true });
  for (const file of [codexFile, unknownFile]) {
    fs.writeFileSync(file, "installed");
    f.receipt.files[file] = { component: "skill", hash: createHash("sha256").update("installed").digest("hex") };
  }
  const claude = buildPlan(f.manifest, f.repo, f.roots, f.receipt, ["skill"], new Map(), ["claude"]);
  assert.deepEqual(claude.stale, [unknownFile]);
  const codex = buildPlan(f.manifest, f.repo, f.roots, f.receipt, ["skill"], new Map(), ["codex"]);
  assert.deepEqual(codex.stale, [unknownFile]);
});
