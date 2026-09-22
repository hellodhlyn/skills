import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { createRun, approveRun, planHash, reviseRun } from "../src/workflow.mjs";
import { acquire, load, save, cancel, runDirectory } from "../src/store.mjs";
import { snapshot, validatePlanPaths } from "../src/repository.mjs";

test("approval binds exact content, survives reload, and protects existing changes", () => {
  const base = mkdtempSync('/private/tmp/planagent-state-');
  const project = path.join(base, 'project'); mkdirSync(project);
  const previous = process.env.PLANAGENT_STATE_DIR;
  process.env.PLANAGENT_STATE_DIR = path.join(base, 'state');
  try {
    writeFileSync(path.join(project, 'code.mjs'), 'export const value = 1;\n');
    writeFileSync(path.join(project, 'user.txt'), 'original\n');
    const git = (...args) => execFileSync('git', ['-c','user.name=seq030','-c','user.email=218389549+seq030@users.noreply.github.com','-c','commit.gpgsign=false',...args], {cwd:project,stdio:'pipe'});
    git('init','--initial-branch=main'); git('add','.'); git('commit','-m','Create state test fixture');
    writeFileSync(path.join(project, 'user.txt'), 'user change\n');
    const run = createRun('Change the value', project);
    run.plan = { summary:'Change value', files:['code.mjs'], steps:['Update constant'], conditions:[{id:'C1',description:'value is two'}], checks:[{id:'V1',argv:['mise','exec','--','node','--check','code.mjs']}], ui:false, visualEvidence:[], questions:[] };
    validatePlanPaths(project, run.plan, run.dirtyPaths);
    assert.throws(() => validatePlanPaths(project, {...run.plan,files:['user.txt']}, run.dirtyPaths));
    run.stage='approval'; run.status='waiting_approval'; save(run);
    const hash = planHash(run);
    assert.throws(() => approveRun(run, 'wrong'));
    const release = acquire(project, run.id);
    assert.throws(() => acquire(project, 'another-run'));
    release();
    approveRun(run, hash);
    assert.equal(load(run.id).stage, 'implement');
    assert.equal(load(run.id).approval.hash, hash);
    assert.equal(readFileSync(path.join(project,'user.txt'),'utf8'), 'user change\n');
    assert.ok(readFileSync(path.join(runDirectory(run.id),'approval.json'),'utf8').includes(hash));
    run.implementationStarted = true;
    const previousPlan = run.plan;
    const baselineId = run.baseline.id;
    writeFileSync(path.join(project,'code.mjs'),'export const value = 2;\n');
    reviseRun(run, 'Use a more specific validation command');
    assert.equal(run.approval, undefined);
    assert.equal(run.baseline.id, baselineId);
    assert.deepEqual(run.alreadyChangedFiles,['code.mjs']);
    assert.equal(load(run.id).stage,'plan');
    assert.equal(cancel(run.id).status,'cancelled');
    const changed = createRun('Another change', project);
    changed.plan=previousPlan; changed.stage='approval'; changed.status='waiting_approval';
    writeFileSync(path.join(project,'code.mjs'),'export const value = 3;\n');
    assert.notEqual(snapshot(project).id, changed.codeState.id);
    assert.throws(() => approveRun(changed,planHash(changed)), /changed after planning/);
  } finally {
    if (previous === undefined) delete process.env.PLANAGENT_STATE_DIR; else process.env.PLANAGENT_STATE_DIR = previous;
    rmSync(base,{recursive:true,force:true});
  }
});
