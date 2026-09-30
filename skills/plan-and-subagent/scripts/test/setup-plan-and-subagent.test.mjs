import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { applyPlan, assertSafeDestination, buildPlan, command, effectivePermission, loadReceipt, missingLinks, parseArguments, resolveRoots, validateResolvedAgent } from "../lib/setup-plan-and-subagent.mjs";

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
  const roots = Object.fromEntries(["codex", "claude", "environment", "opencode", "legacyOpencode", "browser", "state"].map((name) => [name, path.join(directory, name)]));
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
  assert.equal(parseArguments(["--dry-run", "--profile", "codex"]).profile, "codex");
  assert.equal(parseArguments(["--dry-run", "--profile", "claude"]).profile, "claude");
  assert.throws(() => parseArguments(["--dry-run", "--profile", "glm"]));
  assert.throws(() => parseArguments(["--dry-run", "--profile", "both"]));
  assert.throws(() => parseArguments(["--dry-run", "--profile", "unknown"]));
  assert.throws(() => resolveRoots({ PLAN_AND_SUBAGENT_UI_BROWSER_DIR: "relative" }, "/home/test"));
});

test("the Codex inventory installs GPT-6 roles and no independent GLM profile", (t) => {
  const f = fixture(t);
  const manifest = JSON.parse(fs.readFileSync(path.join(repository, "skills/plan-and-subagent/scripts/plan-and-subagent-install.json"), "utf8"));
  const selected = ["skill", "skill-opencode", "profile", "codex", "claude", "opencode", "ui-browser"];
  const codex = buildPlan(manifest, repository, f.roots, f.receipt, selected, new Map(), ["codex"]);
  assert.ok(codex.files.some((entry) => entry.target.endsWith("profiles/codex/PROFILE.md")));
  assert.ok(codex.files.some((entry) => entry.target.endsWith("agents/luna_implementer.toml")));
  assert.ok(codex.files.some((entry) => entry.target.endsWith("agents/reviewer.md")));
  assert.equal(codex.files.some((entry) => entry.target.endsWith("agents/ui_ux_designer.toml")), false);
  assert.equal(codex.files.some((entry) => entry.target.endsWith("profiles/glm/opencode.jsonc")), false);
  assert.equal(manifest.profiles.includes("glm"), false);
  assert.equal(manifest.removeProfileFiles.filter((entry) => entry.profile === "glm").length, 7);
  assert.ok(manifest.retired.some((entry) => entry.component === "opencode"
    && entry.root === "opencode" && entry.target === "agents/advisor.md"));
  assert.equal(fs.existsSync(path.join(repository, "profiles/codex/opencode/agents/advisor.md")), false);
  assert.equal(fs.existsSync(path.join(repository, "profiles/glm")), false);
  assert.match(fs.readFileSync(path.join(repository, "profiles/codex/PROFILE.md"), "utf8"), /GPT-6\.1 Sol \(`gpt-6\.1-sol`\)/);
  assert.match(fs.readFileSync(path.join(repository, "profiles/codex/codex/agents/luna_implementer.toml"), "utf8"), /model = "gpt-6-luna"/);
});

test("the Codex profile runs the shared Claude UI/UX roles and retires its GLM and GPT UI/UX roles", (t) => {
  const f = fixture(t);
  const manifest = JSON.parse(fs.readFileSync(path.join(repository, "skills/plan-and-subagent/scripts/plan-and-subagent-install.json"), "utf8"));
  const selected = ["skill", "skill-opencode", "profile", "codex", "claude", "opencode", "ui-browser"];
  const targets = buildPlan(manifest, repository, f.roots, f.receipt, selected, new Map(), ["codex"]).files.map((entry) => entry.target);
  for (const name of ["claude-ui-ux-designer", "claude-ui-ux-reviewer", "claude-mockup"]) {
    assert.ok(targets.includes(path.join(f.roots.claude, "agents", `${name}.md`)), name);
  }
  assert.equal(targets.some((target) => within(path.join(f.roots.claude, "skills"), target)), false);
  assert.equal(targets.some((target) => within(path.join(f.roots.opencode, "skills"), target)), false);
  for (const retired of ["agents/luna_mockup.toml", "agents/codex-ui-ux.md", "profiles/codex/opencode.jsonc", "skills/plan-and-subagent"]) {
    assert.equal(targets.some((target) => target.endsWith(retired)), false, retired);
    assert.ok(manifest.retired.some((entry) => entry.profile === "codex" && entry.target === retired), retired);
  }
  for (const removed of ["profiles/codex/codex/agents/luna_mockup.toml", "profiles/codex/opencode", "profiles/codex/opencode.jsonc", "skills/plan-and-subagent/scripts/run-opencode-ui-ux.sh"]) {
    assert.equal(fs.existsSync(path.join(repository, removed)), false, removed);
  }
  assert.deepEqual(manifest.checks.codex.opencodeAgents, []);
  assert.deepEqual(manifest.checks.codex.authentication.map((check) => check.argv), [["claude", "auth", "status"], ["codex", "login", "status"]]);
  const profile = fs.readFileSync(path.join(repository, "profiles/codex/PROFILE.md"), "utf8");
  for (const expected of ["claude-ui-ux-designer", "claude-ui-ux-reviewer", "claude-mockup", "scripts/run-claude-agent.sh", "SESSION_DIR/mockups/"]) {
    assert.ok(profile.includes(expected), expected);
  }
  assert.doesNotMatch(profile, /codex-ui-ux|luna_mockup|visualize/);
  assert.match(fs.readFileSync(path.join(repository, "skills/plan-and-subagent/tools/hosts/codex.md"), "utf8"), /\[Claude CLI execution\]\(claude-cli\.md\)/);
  assert.doesNotMatch(fs.readFileSync(path.join(repository, "skills/plan-and-subagent/tools/hosts/opencode.md"), "utf8"), /ui-ux/i);
});

test("the Claude inventory installs native Claude roles and shares the OpenCode reviewer", (t) => {
  const f = fixture(t);
  const manifest = JSON.parse(fs.readFileSync(path.join(repository, "skills/plan-and-subagent/scripts/plan-and-subagent-install.json"), "utf8"));
  const selected = ["skill", "skill-opencode", "profile", "codex", "claude", "opencode", "ui-browser"];
  const claude = buildPlan(manifest, repository, f.roots, f.receipt, selected, new Map(), ["claude"]);
  const targets = claude.files.map((entry) => entry.target);
  for (const expected of [
    path.join(f.roots.claude, "skills/plan-and-subagent/SKILL.md"),
    path.join(f.roots.claude, "skills/plan-and-subagent/tools/hosts/claude-code.md"),
    path.join(f.roots.claude, "agents/claude-ui-ux-designer.md"),
    path.join(f.roots.claude, "agents/claude-ui-ux-reviewer.md"),
    path.join(f.roots.claude, "agents/claude-mockup.md"),
    path.join(f.roots.environment, "profiles/claude/PROFILE.md"),
    path.join(f.roots.environment, "profiles/claude/codex/implementer.md"),
    path.join(f.roots.opencode, "agents/reviewer.md"),
    path.join(f.roots.browser, "server.mjs"),
  ]) assert.ok(targets.includes(expected), expected);
  assert.equal(targets.some((target) => within(f.roots.codex, target)), false);
  assert.equal(targets.some((target) => target.endsWith("agents/codex-ui-ux.md") || target.endsWith("profiles/codex/opencode.jsonc")), false);
  assert.equal(targets.some((target) => within(path.join(f.roots.opencode, "skills"), target)), false);
  assert.deepEqual(missingLinks(claude.files, true, true), []);
  assert.match(fs.readFileSync(path.join(repository, "profiles/shared/opencode/agents/reviewer.md"), "utf8"), /^model: zai-coding-plan\/glm-5\.3-flash$/m);
  assert.match(fs.readFileSync(path.join(repository, "profiles/shared/opencode/agents/reviewer.md"), "utf8"), /^reasoningEffort: max$/m);
});

test("Claude subagents keep their model, effort, and tool boundaries", () => {
  const read = (name) => fs.readFileSync(path.join(repository, "profiles/shared/claude/agents", `${name}.md`), "utf8");
  const frontmatter = (text) => text.split("---")[1];
  const tools = (text) => frontmatter(text).match(/^tools: (.*)$/m)[1].split(",").map((tool) => tool.trim());
  const browserTools = ["load_request", "navigate", "viewport", "act", "capture", "audit"].map((tool) => `mcp__ui-browser__${tool}`);
  for (const [name, model, effort, writes, delegation] of [
    ["claude-ui-ux-designer", "claude-opus-5-5", "high", false, ["Agent(claude-mockup)", "SendMessage"]],
    ["claude-ui-ux-reviewer", "claude-opus-5-5", "medium", false, []],
    ["claude-mockup", "claude-sonnet-5-5", "medium", true, []],
  ]) {
    const text = read(name);
    assert.match(frontmatter(text), new RegExp(`^name: ${name}$`, "m"));
    assert.match(frontmatter(text), new RegExp(`^model: ${model}$`, "m"));
    assert.match(frontmatter(text), new RegExp(`^effort: ${effort}$`, "m"));
    assert.match(frontmatter(text), /^  - ui-browser:$/m);
    assert.match(frontmatter(text), /opencode-ui-browser\}?\/server\.mjs/);
    const allowed = tools(text);
    assert.deepEqual(allowed.filter((tool) => tool.startsWith("mcp__")), browserTools);
    for (const forbidden of ["Bash", "Agent", "WebFetch", "WebSearch", "NotebookEdit"]) assert.equal(allowed.includes(forbidden), false, `${name}: ${forbidden}`);
    assert.equal(allowed.includes("Write") || allowed.includes("Edit"), writes, name);
    assert.deepEqual(allowed.filter((tool) => tool.startsWith("Agent") || tool === "SendMessage"), delegation, name);
  }
  const profile = fs.readFileSync(path.join(repository, "profiles/claude/PROFILE.md"), "utf8");
  assert.match(profile, /GPT-6 Luna \(`gpt-6-luna`\)/);
  assert.match(profile, /effort `xhigh`/);
  assert.match(profile, /\[codex\/implementer\.md\]\(codex\/implementer\.md\)/);
});

test("read-only permission evaluation denies unknown tools while allowing installed contracts", (t) => {
  const f = fixture(t);
  const policies = [
    { permission: "*", action: "allow", pattern: "*" },
    { permission: "*", action: "deny", pattern: "*" },
    { permission: "read", action: "allow", pattern: "*" },
    { permission: "glob", action: "allow", pattern: "*" },
    { permission: "grep", action: "allow", pattern: "*" },
    { permission: "lsp", action: "allow", pattern: "*" },
    { permission: "skill", action: "deny", pattern: "*" },
    { permission: "skill", action: "allow", pattern: "plan-and-subagent" },
    { permission: "external_directory", action: "allow", pattern: "*" },
    { permission: "bash", action: "deny", pattern: "*" },
    { permission: "bash", action: "allow", pattern: "cat *" },
    { permission: "bash", action: "allow", pattern: "find *" },
    { permission: "bash", action: "allow", pattern: "git diff *" },
    { permission: "bash", action: "allow", pattern: "rg *" },
    { permission: "bash", action: "deny", pattern: "rg *--pre*" },
    { permission: "bash", action: "deny", pattern: "find *-delete*" },
    { permission: "bash", action: "deny", pattern: "git * --output*" },
    { permission: "bash", action: "deny", pattern: "*>*" },
  ];
  const agent = {
    name: "reviewer",
    mode: "subagent",
    model: { providerID: "opencode-go", modelID: "glm-5.3-flash" },
    permission: policies,
  };
  assert.equal(effectivePermission(policies, "mcp_test_write", "*"), "deny");
  assert.equal(effectivePermission(policies, "skill", "plan-and-subagent"), "allow");
  assert.equal(effectivePermission(policies, "skill", "unapproved-skill"), "deny");
  assert.equal(effectivePermission(policies, "bash", "git diff main...HEAD"), "allow");
  assert.equal(effectivePermission(policies, "external_directory", "/outside/project/file"), "allow");
  const writable = policies.filter((policy) => policy.pattern !== "*>*");
  assert.match(validateResolvedAgent({ ...agent, permission: writable }, { name: "reviewer", mode: "subagent", provider: "opencode-go", model: "glm-5.3-flash", readOnly: true }, f.roots).join(), /bash:cat a > b=not-denied/);
  assert.deepEqual(validateResolvedAgent(agent, {
    name: "reviewer",
    mode: "subagent",
    provider: "opencode-go",
    model: "glm-5.3-flash",
    allowed: ["read", "glob", "grep", "lsp", "skill"],
    denied: ["edit", "write", "bash", "task", "webfetch", "websearch", "question"],
    skills: ["plan-and-subagent"],
    readOnly: true,
  }, f.roots), []);
});

test("the source inventory is self-contained under skill and profile roots", (t) => {
  const f = fixture(t);
  const manifest = JSON.parse(fs.readFileSync(path.join(repository, "skills/plan-and-subagent/scripts/plan-and-subagent-install.json"), "utf8"));
  const selected = ["skill", "skill-opencode", "profile", "codex", "opencode", "ui-browser"];
  const plan = buildPlan(manifest, repository, f.roots, f.receipt, selected, new Map(), ["codex"]);
  assert.deepEqual(missingLinks(plan.files, true), []);
  assert.deepEqual(missingLinks(plan.files, true, true), []);
  for (const obsoleteRoot of ["environments", "opencode", "scripts"]) {
    assert.equal(fs.existsSync(path.join(repository, obsoleteRoot)), false, obsoleteRoot);
  }
  assert.equal(fs.existsSync(path.join(repository, "skills/plan-and-subagent/scripts/plan-and-subagent-install.json")), true);
});

test("retired profile cleanup removes only unchanged receipt-owned files", (t) => {
  const f = fixture(t);
  f.manifest.removeProfileFiles = [
    { profile: "glm", component: "profile", root: "environment", target: "profiles/glm/PROFILE.md" },
    { profile: "glm", component: "opencode", root: "opencode", target: "profiles/glm/opencode.jsonc" },
    { profile: "glm", component: "opencode", root: "opencode", target: "agents/glm-reviewer.md" },
    { profile: "glm", component: "opencode", root: "opencode", target: "agents/glm-mockup.md" },
  ];
  const tracked = [
    [path.join(f.roots.environment, "profiles/glm/PROFILE.md"), "profile", "old profile"],
    [path.join(f.roots.opencode, "profiles/glm/opencode.jsonc"), "opencode", "old config"],
    [path.join(f.roots.opencode, "agents/glm-reviewer.md"), "opencode", "old agent"],
  ];
  fs.mkdirSync(f.roots.state, { recursive: true });
  for (const [target, component, contents] of tracked) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
    f.receipt.files[target] = {
      component,
      profile: "glm",
      hash: createHash("sha256").update(contents).digest("hex"),
    };
  }
  const unmanaged = path.join(f.roots.opencode, "agents/personal.md");
  fs.writeFileSync(unmanaged, "keep me");
  const untrackedRetired = path.join(f.roots.opencode, "agents/glm-mockup.md");
  fs.writeFileSync(untrackedRetired, "untracked local file");
  fs.writeFileSync(f.receiptPath, JSON.stringify(f.receipt));

  const plan = buildPlan(f.manifest, f.repo, f.roots, loadReceipt(f.receiptPath), ["environment", "profile", "opencode"]);
  assert.deepEqual(plan.removals.map((entry) => entry.target).sort(), tracked.map(([target]) => target).sort());
  assert.deepEqual(plan.retirementConflicts, []);
  assert.deepEqual(plan.untrackedRetired, [untrackedRetired]);
  applyPlan(plan, loadReceipt(f.receiptPath), f.receiptPath);

  for (const [target] of tracked) assert.equal(fs.existsSync(target), false);
  assert.equal(fs.existsSync(unmanaged), true);
  assert.equal(fs.readFileSync(untrackedRetired, "utf8"), "untracked local file");
  assert.ok(tracked.every(([target]) => !Object.hasOwn(loadReceipt(f.receiptPath).files, target)));
  assert.equal(fs.existsSync(path.join(f.roots.environment, "profiles/glm")), false);
  assert.equal(fs.existsSync(path.join(f.roots.opencode, "profiles/glm")), false);
});

test("modified retired profile files are preserved and block all writes", (t) => {
  const f = fixture(t);
  f.manifest.removeProfileFiles = [
    { profile: "glm", component: "profile", root: "environment", target: "profiles/glm/PROFILE.md" },
  ];
  const target = path.join(f.roots.environment, "profiles/glm/PROFILE.md");
  const original = "installed profile";
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, "local customization");
  fs.mkdirSync(f.roots.state, { recursive: true });
  f.receipt.files[target] = {
    component: "profile",
    profile: "glm",
    hash: createHash("sha256").update(original).digest("hex"),
  };
  fs.writeFileSync(f.receiptPath, JSON.stringify(f.receipt));

  const plan = buildPlan(f.manifest, f.repo, f.roots, loadReceipt(f.receiptPath), ["environment", "profile"]);
  assert.deepEqual(plan.retirementConflicts, [target]);
  assert.throws(() => applyPlan(plan, loadReceipt(f.receiptPath), f.receiptPath), /local changes and were preserved/);
  assert.equal(fs.readFileSync(target, "utf8"), "local customization");
  assert.equal(fs.existsSync(path.join(f.roots.environment, "a.md")), false);
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
  f.manifest.retired = [{ component: "environment", root: "environment", target: "retired.md" }];
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
else if(args.includes('mcp') && args.includes('list')) {console.log('ui-browser (local)');}
else if(args.includes('agent')) {const directory=path.join(process.env.OPENCODE_CONFIG_DIR,'agents'); if(fs.existsSync(directory)) {for(const file of fs.readdirSync(directory).filter((name)=>name.endsWith('.md')).sort()) console.log(file.slice(0,-3)+' (primary)');} else {console.log('reviewer (primary)');}}
else if(args.includes('install') && process.env.SETUP_TEST_FAIL_INSTALL) {console.error('fixture dependency failure');process.exitCode=1;}
else if(args.includes('-e') && process.env.SETUP_TEST_FAIL_BROWSER) {console.error('fixture browser failure');process.exitCode=1;}
else if(args.includes('login') && process.env.SETUP_TEST_CODEX_LOGGED_OUT) {console.error('Not logged in');process.exitCode=1;}
else if(args.includes('auth') && process.env.SETUP_TEST_CLAUDE_LOGGED_OUT) {console.error('Not logged in');process.exitCode=1;}
`;
  for (const name of ["gh", "opencode", "pnpm", "node", "codex", "claude"]) fs.writeFileSync(path.join(bin, name), program, { mode: 0o755 });
  const log = path.join(f.directory, "commands.jsonl");
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`,
    PLAN_AND_SUBAGENT_CODEX_DIR: f.roots.codex,
    PLAN_AND_SUBAGENT_CLAUDE_DIR: f.roots.claude,
    AGENT_ENVIRONMENT_DIR: f.roots.environment, OPENCODE_CONFIG_DIR: f.roots.opencode,
    OPENCODE_LEGACY_CONFIG_DIR: f.roots.legacyOpencode,
    PLAN_AND_SUBAGENT_UI_BROWSER_DIR: f.roots.browser,
    PLAN_AND_SUBAGENT_SETUP_DIR: f.roots.state,
    SETUP_TEST_LOG: log,
  };
  fs.mkdirSync(f.roots.codex);
  fs.writeFileSync(path.join(f.roots.codex, "AGENTS.md"), `Read ${path.join(f.roots.environment, "profiles/codex/PROFILE.md")} when running plan-and-subagent.`);
  fs.mkdirSync(f.roots.claude);
  fs.writeFileSync(path.join(f.roots.claude, "CLAUDE.md"), `Read ${path.join(f.roots.environment, "profiles/claude/PROFILE.md")} when running plan-and-subagent.`);
  fs.writeFileSync(path.join(f.roots.claude, "settings.json"), JSON.stringify({ permissions: { allow: ["Bash(codex exec *)", "Read(~/.knowledges/**)", "Read(~/Workspace/bakb/**)"] } }));
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
  for (const file of [path.join(f.roots.codex, "skills/plan-and-subagent/SKILL.md"), path.join(f.roots.codex, "agents/luna_implementer.toml"), path.join(f.roots.claude, "agents/claude-mockup.md"), path.join(f.roots.environment, "profiles/codex/PROFILE.md"), path.join(f.roots.opencode, "agents/reviewer.md"), path.join(f.roots.browser, "server.mjs")]) {
    assert.ok(fs.existsSync(file), file);
  }
  assert.equal(fs.existsSync(path.join(f.roots.opencode, "skills")), false);
  assert.equal(fs.existsSync(path.join(f.roots.claude, "skills")), false);
  assert.match(apply.stdout, /\[PASS\] Claude Code login/);
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

test("browser failure is not hidden by passing package checks", (t) => {
  const f = fixture(t);
  const { run } = fakeCommands(f);
  const failed = run(["--apply"], { SETUP_TEST_FAIL_BROWSER: "1" });
  assert.equal(failed.status, 1);
  assert.match(failed.stdout, /\[PASS\] UI browser package/);
  assert.match(failed.stdout, /\[FAIL\] UI browser Chromium/);
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
  // Use real Node for the wrapper while keeping runtime/auth commands isolated.
  const node = path.join(f.directory, "bin/node");
  fs.unlinkSync(node);
  fs.symlinkSync(process.execPath, node);
  const result = spawnSync("bash", [path.join(repository, "skills/plan-and-subagent/scripts/install-agent-environment.sh")], {
    env, encoding: "utf8", timeout: 15_000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(f.roots.environment, "profiles/codex/PROFILE.md")));
  assert.equal(fs.existsSync(path.join(f.roots.codex, "agents")), false);
  assert.match(result.stdout, /Component-only result/);
});

test("Claude profile installs beside Codex without touching or misreporting Codex files", (t) => {
  const f = fixture(t);
  const { run, calls } = fakeCommands(f);
  const codex = run(["--apply"]);
  assert.equal(codex.status, 0, codex.stdout + codex.stderr);
  const codexSkill = path.join(f.roots.codex, "skills/plan-and-subagent/SKILL.md");
  const codexBefore = fs.readFileSync(codexSkill, "utf8");
  const dry = run(["--dry-run", "--profile", "claude"]);
  assert.equal(dry.status, 0, dry.stdout + dry.stderr);
  assert.equal(fs.existsSync(path.join(f.roots.claude, "skills")), false);
  const apply = run(["--apply", "--profile", "claude"]);
  assert.equal(apply.status, 0, apply.stdout + apply.stderr);
  for (const file of [path.join(f.roots.claude, "skills/plan-and-subagent/SKILL.md"), path.join(f.roots.claude, "agents/claude-ui-ux-reviewer.md"), path.join(f.roots.environment, "profiles/claude/codex/implementer.md")]) {
    assert.ok(fs.existsSync(file), file);
  }
  assert.doesNotMatch(apply.stdout, /Obsolete managed file/);
  assert.doesNotMatch(apply.stdout, /\[(UPDATE|CONFLICT)\].*(reviewer|claude-mockup)\.md/);
  assert.doesNotMatch(apply.stdout, /OpenCode agent discovery/);
  assert.doesNotMatch(apply.stdout, /codex-ui-ux/);
  assert.match(apply.stdout, /\[PASS\] Codex CLI login/);
  assert.match(apply.stdout, /\[PASS\] Global profile designation: Profile path found in .*CLAUDE\.md/);
  assert.equal(fs.readFileSync(codexSkill, "utf8"), codexBefore);
  assert.ok(calls().some((call) => call[0] === "gh" && call.includes("claude-code")));
  const receipt = loadReceipt(f.receiptPath);
  assert.deepEqual(receipt.files[path.join(f.roots.opencode, "agents/reviewer.md")].profiles, ["codex", "claude"]);
  assert.deepEqual(receipt.files[path.join(f.roots.claude, "agents/claude-mockup.md")].profiles, ["codex", "claude"]);
  assert.equal(run(["--check"]).status, 0);
});

test("older receipts without profile ownership are not reported as obsolete for another profile", (t) => {
  const f = fixture(t);
  f.manifest.entries = [
    { component: "environment", profiles: ["codex"], root: "environment", source: "a.md", target: "codex-only/a.md" },
    { component: "environment", profile: "claude", root: "environment", source: "b.md", target: "claude/b.md" },
  ];
  const codexFile = path.join(f.roots.environment, "codex-only/a.md");
  const unknownFile = path.join(f.roots.environment, "unknown.md");
  fs.mkdirSync(path.dirname(codexFile), { recursive: true });
  for (const file of [codexFile, unknownFile]) {
    fs.writeFileSync(file, "installed");
    f.receipt.files[file] = { component: "environment", hash: createHash("sha256").update("installed").digest("hex") };
  }
  const claude = buildPlan(f.manifest, f.repo, f.roots, f.receipt, ["environment"], new Map(), ["claude"]);
  assert.deepEqual(claude.stale, [unknownFile]);
  const codex = buildPlan(f.manifest, f.repo, f.roots, f.receipt, ["environment"], new Map(), ["codex"]);
  assert.deepEqual(codex.stale, [unknownFile]);
});

test("Claude profile reports missing Codex login and designation as user actions", (t) => {
  const f = fixture(t);
  const { run } = fakeCommands(f);
  fs.writeFileSync(path.join(f.roots.claude, "CLAUDE.md"), "Other instructions\n");
  const result = run(["--apply", "--profile", "claude"], { SETUP_TEST_CODEX_LOGGED_OUT: "1" });
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stdout, /\[ACTION_REQUIRED\] Codex CLI login/);
  assert.match(result.stdout, /\[ACTION_REQUIRED\] Global profile designation/);
  assert.equal(fs.readFileSync(path.join(f.roots.claude, "CLAUDE.md"), "utf8"), "Other instructions\n");
});

test("Claude profile reports missing knowledge read permissions without editing settings", (t) => {
  const f = fixture(t);
  const { run } = fakeCommands(f);
  const settings = path.join(f.roots.claude, "settings.json");
  const original = JSON.stringify({ permissions: { allow: ["Read(~/.knowledges/**)"] } });
  fs.writeFileSync(settings, original);
  const result = run(["--apply", "--profile", "claude"]);
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stdout, /\[ACTION_REQUIRED\] Knowledge read permissions: Add Read\(~\/Workspace\/bakb\/\*\*\) to permissions\.allow/);
  assert.equal(fs.readFileSync(settings, "utf8"), original);
  fs.rmSync(settings);
  assert.match(run(["--check", "--profile", "claude"]).stdout, /\[ACTION_REQUIRED\] Knowledge read permissions: .*file is missing/);
  assert.doesNotMatch(run(["--check"]).stdout, /Knowledge read permissions/);
});

test("personal knowledge sources stay in the profile layer", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(repository, "skills/plan-and-subagent/scripts/plan-and-subagent-install.json"), "utf8"));
  const knowledge = fs.readFileSync(path.join(repository, "profiles/shared/KNOWLEDGE.md"), "utf8");
  for (const rule of manifest.checks.claude.readPermissions.rules) assert.ok(knowledge.includes(rule), rule);
  for (const profile of ["codex", "claude"]) {
    assert.match(fs.readFileSync(path.join(repository, "profiles", profile, "PROFILE.md"), "utf8"), /\]\(\.\.\/shared\/KNOWLEDGE\.md\)/);
  }
  const skill = path.join(repository, "skills/plan-and-subagent");
  const documents = fs.readdirSync(skill, { recursive: true }).filter((file) => !file.includes("node_modules") && /\.(md|sh|mjs)$/.test(file) && !file.includes("test/"));
  for (const file of documents) {
    assert.doesNotMatch(fs.readFileSync(path.join(skill, file), "utf8"), /\.knowledges|bakb/i, file);
  }
});

test("Codex profile reports a missing Claude Code login as a user action", (t) => {
  const f = fixture(t);
  const { run } = fakeCommands(f);
  const result = run(["--apply"], { SETUP_TEST_CLAUDE_LOGGED_OUT: "1" });
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stdout, /\[PASS\] Claude Code CLI for UI\/UX roles/);
  assert.match(result.stdout, /\[ACTION_REQUIRED\] Claude Code login/);
});

test("an existing Codex installation reports its retired UI/UX files without deleting them", (t) => {
  const f = fixture(t);
  const { run } = fakeCommands(f);
  const legacy = [
    path.join(f.roots.codex, "agents/luna_mockup.toml"),
    path.join(f.roots.opencode, "agents/codex-ui-ux.md"),
    path.join(f.roots.opencode, "profiles/codex/opencode.jsonc"),
    path.join(f.roots.opencode, "skills/plan-and-subagent/SKILL.md"),
  ];
  fs.mkdirSync(f.roots.state, { recursive: true });
  const receipt = { version: 1, files: {} };
  for (const file of legacy) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "legacy");
    receipt.files[file] = { component: file.includes("/skills/") ? "skill-opencode" : file.includes("luna_") ? "codex" : "opencode", profile: "codex", hash: createHash("sha256").update("legacy").digest("hex") };
  }
  fs.writeFileSync(f.receiptPath, JSON.stringify(receipt));
  const result = run(["--apply"]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const file of legacy) {
    assert.ok(result.stdout.includes(`[NOTICE] Obsolete managed file (preserved): ${file}`), file);
    assert.equal(fs.readFileSync(file, "utf8"), "legacy");
  }
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
  modelUsage:{'claude-sonnet-5-5':{}}}));
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
  let result = run(["start", workdir, session, design, "claude-ui-ux-designer"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(read(design, "result.md"), "design report");
  assert.equal(read(design, "session-id"), "session-1");
  assert.equal(read(design, "models"), "claude-sonnet-5-5");
  assert.equal(read(design, "exit-code"), "0");
  let call = JSON.parse(fs.readFileSync(log, "utf8"));
  assert.equal(call.cwd, fs.realpathSync(workdir));
  assert.equal(call.prompt, "handoff");
  assert.deepEqual(call.args.slice(0, 7), ["-p", "--agent", "claude-ui-ux-designer", "--output-format", "json", "--permission-mode", "dontAsk"]);
  assert.deepEqual(call.args.slice(call.args.indexOf("--add-dir") + 1, call.args.indexOf("--add-dir") + 3),
    [path.join(repository, "skills/plan-and-subagent"), fs.realpathSync(session)]);
  assert.equal(call.args.some((arg) => arg.startsWith("Edit(") || arg.includes("bypass") || arg === "--bare"), false);

  const mockup = runDir("run-2");
  result = run(["start", workdir, session, mockup, "claude-mockup", mockups]);
  assert.equal(result.status, 0, result.stderr);
  call = JSON.parse(fs.readFileSync(log, "utf8"));
  assert.ok(call.args.includes(`Edit(/${fs.realpathSync(mockups)}/**)`));

  const correction = runDir("run-3");
  assert.equal(run(["resume", workdir, session, correction, "claude-mockup", "session-1", mockups]).status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(log, "utf8")).args.slice(-2), ["--resume", "session-1"]);
  const mismatch = runDir("run-4");
  assert.equal(run(["resume", workdir, session, mismatch, "claude-mockup", "session-1"], { RUNNER_TEST_SESSION: "other" }).status, 3);
  assert.match(read(mismatch, "stderr.log"), /does not match/);
  const failed = runDir("run-5");
  assert.equal(run(["start", workdir, session, failed, "claude-ui-ux-reviewer"], { RUNNER_TEST_ERROR: "1" }).status, 3);
  assert.equal(read(failed, "exit-code"), "3");

  assert.equal(run(["start", workdir, session, design, "claude-ui-ux-designer"]).status, 2);
  assert.equal(run(["start", workdir, session, runDir("run-6"), "claude-mockup", session]).status, 2);
  assert.equal(run(["start", workdir, session, runDir("run-7"), "claude-mockup", workdir]).status, 2);
  const knowledge = path.join(f.directory, "knowledge");
  fs.mkdirSync(knowledge);
  const withKnowledge = runDir("run-8");
  assert.equal(run(["start", "--read-dir", knowledge, workdir, session, withKnowledge, "claude-ui-ux-designer"]).status, 0);
  call = JSON.parse(fs.readFileSync(log, "utf8"));
  assert.deepEqual(call.args.slice(call.args.indexOf("--add-dir") + 1, call.args.indexOf("--allowedTools")),
    [path.join(repository, "skills/plan-and-subagent"), fs.realpathSync(session), fs.realpathSync(knowledge)]);
  assert.equal(call.args.some((arg) => arg.startsWith("Edit(")), false);
  assert.equal(run(["start", "--read-dir", "relative", workdir, session, runDir("run-9"), "claude-ui-ux-designer"]).status, 2);
  assert.equal(run(["start", "--read-dir", path.join(f.directory, "missing"), workdir, session, runDir("run-10"), "claude-ui-ux-designer"]).status, 2);
  const outside = path.join(f.directory, "outside");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "prompt.md"), "handoff");
  assert.equal(run(["start", workdir, session, outside, "claude-ui-ux-designer"]).status, 2);
});
