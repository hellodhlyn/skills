import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, realpathSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { assertResult } from "../src/contracts.mjs";
import { safePath, changedPaths } from "../src/repository.mjs";
import { completionReady, planHash, approveRun } from "../src/workflow.mjs";
import { readProfile } from "../src/profile.mjs";

test("a clean-looking review cannot omit or duplicate conditions", () => {
  const report = { summary: "Reviewed", conditions: [{ id: "C1", status: "PASS", evidence: "test output" }], findings: [] };
  assert.throws(() => assertResult("review", report, ["C1", "C2"]));
  assert.throws(() => assertResult("review", { ...report, conditions: [...report.conditions, ...report.conditions] }, ["C1", "C2"]));
  assert.throws(() => assertResult("review", { ...report, conditions: [{ id: "C1", status: "UNVERIFIED", evidence: "No runtime evidence" }] }, ["C1"]));
  assertResult("review", report, ["C1"]);
});

test("triage and recheck must cover the accepted findings exactly", () => {
  assert.throws(() => assertResult("triage", { decisions: [] }, ["F1"]));
  assert.throws(() => assertResult("recheck", { findings: [{ id: "other", status: "RESOLVED", evidence: "fixed" }], conditions: [{ id: "C1", status: "PASS", evidence: "checked" }] }, ["F1"]));
});

test("ownership rejects traversal, git metadata, and symlink escapes", () => {
  const temporary = mkdtempSync(path.join(tmpdir(), "planagent-path-"));
  const project = path.join(temporary, "project"); mkdirSync(project);
  try {
    symlinkSync(temporary, path.join(project, "outside"));
    symlinkSync(path.join(temporary, "does-not-exist"), path.join(project, "dangling"));
    for (const file of ["../secret", ".git/config", "src/../../secret", "outside/new/file", "dangling", "dangling/child", "/tmp/file"]) assert.throws(() => safePath(project, file));
    assert.equal(safePath(project, "src/new.mjs"), path.join(realpathSync(project), "src/new.mjs"));
    const before = { files: { "owned": { hash: "a" }, "user": { hash: "b" } } };
    const after = { files: { "owned": { hash: "c" }, "user": { hash: "b" } } };
    assert.deepEqual(changedPaths(before, after), ["owned"]);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("completion rejects stale checks, unresolved findings, missing UI evidence and altered approval", () => {
  const report = { conditions: [{ id: "C1", status: "PASS", evidence: "checked" }] };
  const run = { plan: { checks: [{}], ui: false }, codeState: { id: "current" }, validation: [{ status: "PASS" }], validationSnapshot: "current", internalReview: report, internalSnapshot: "current", externalReview: report, externalSnapshot: "current", externalFindings: [] };
  run.approval = { hash: planHash(run) };
  assert.equal(Boolean(completionReady(run)), true);
  for (const change of [{ validationSnapshot: "old" }, { externalSnapshot: "old" }, { externalFindings: [{ id: "F1" }] }, { approval: { hash: "other" } }, { validation: [{ status: "FAIL" }] }]) assert.equal(Boolean(completionReady({ ...run, ...change })), false);
  const ui = { ...run, plan: { ...run.plan, ui: true } }; ui.approval = { hash: planHash(ui) };
  assert.equal(Boolean(completionReady(ui)), false);
  assert.throws(() => approveRun({ stage: "approval", status: "waiting_approval", plan: {} }, "different"));
});

test("selected subscription and specialist model bindings stay explicit", () => {
  const profile = readProfile();
  assert.equal(profile.roles.planner.provider, "openai-codex");
  assert.equal(profile.roles.planner.model, "gpt-5.6-sol");
  assert.equal(profile.roles.implementer.model, "gpt-5.6-luna");
  assert.equal(profile.roles.reviewer.provider, "deepseek");
  assert.equal(profile.roles.reviewer.model, "deepseek-v4-flash");
  assert.equal(profile.roles["ui-ux"].model, "glm-5.3-flash");
});
