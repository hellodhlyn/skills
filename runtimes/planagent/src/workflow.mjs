import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { readProfile } from "./profile.mjs";
import { assertResult, assertCoverage } from "./contracts.mjs";
import { runStage } from "./runtime/stage.mjs";
import { validate } from "./validation.mjs";
import { digest, git, projectRoot, snapshot, dirtyPaths, changedPaths, validatePlanPaths, taskDiff, projectInstructions, safePath } from "./repository.mjs";
import { acquire, load, save, record, runDirectory, stateRoot, writeJson } from "./store.mjs";

export function planHash(run) { return digest({ plan: run.plan, uiDesign: run.uiDesign || null }); }
export function showPlan(run) {
  if (!run.plan) throw new Error("This run has not produced a plan yet.");
  return `# Planagent plan\n\nRun: ${run.id}\nProject: ${run.project}\n\nRequest: ${run.request}\n\n${JSON.stringify(run.plan, null, 2)}\n${run.uiDesign ? `\nUI/UX guidance:\n${run.uiDesign.guidance}\n` : ""}\nPlan hash: ${planHash(run)}\n`;
}
function move(run, stage) { run.stage = stage; save(run); record(run, "stage", { stage }); }
function bound(run, counter, maximum) {
  if (run.counters[counter] >= maximum) throw new Error(`${counter} limit (${maximum}) reached. Required evidence remains incomplete.`);
  run.counters[counter]++; save(run);
}
function pass(report) { return report?.conditions.every((condition) => condition.status === "PASS"); }
function clearEvidence(run) {
  delete run.validation; delete run.internalReview; delete run.uiReview; delete run.externalReview;
  delete run.validationSnapshot; delete run.internalSnapshot; delete run.uiSnapshot; delete run.externalSnapshot;
  delete run.visualEvidence;
}
function reconcile(run, before, writable) {
  const after = snapshot(run.project);
  const changed = changedPaths(before, after);
  const outside = changed.filter((file) => !writable.includes(file));
  if (outside.length) throw new Error(`Changes outside approved ownership: ${outside.join(", ")}`);
  run.codeState = after;
  save(run);
  return after;
}
function input(run) {
  return {
    request: run.request, feedback: run.feedback, project: run.project,
    priorPlan: run.priorPlan, alreadyChangedFiles: run.alreadyChangedFiles,
    instructions: projectInstructions(run.project, run.plan?.files),
    plan: run.plan, uiDesign: run.uiDesign, snapshot: run.codeState.id,
    diff: run.plan ? taskDiff(run.project, run.plan) : undefined,
    validation: run.validation,
    visualEvidence: run.visualEvidence,
  };
}
async function call(run, role, kind, data, signal, expectedIds = [], write = false) {
  bound(run, "calls", run.profile.limits.maxCalls);
  const before = snapshot(run.project);
  const directory = path.join(runDirectory(run.id), "stages", `${String(run.counters.calls).padStart(3, "0")}-${role}`);
  const evidencePaths = (run.validation || []).flatMap((check) => [check.stdoutPath, check.stderrPath]);
  const prompt = `${JSON.stringify(data, null, 2)}\n\nInspect the relevant code independently. Complete this stage with submit_result using its exact schema. Never claim checks you did not run. No other agents, external operations, commits, or installations. Language/runtime validation commands must use mise exec.\n`;
  try {
    const response = await runStage({ project: run.project, directory, role, kind, model: run.profile.roles[role], prompt,
      activePath: path.join(runDirectory(run.id), "active-process.json"),
      writable: write ? run.plan.files : [], evidencePaths, expectedIds, timeoutMs: run.profile.limits.stageTimeoutMs, signal });
    reconcile(run, before, write ? run.plan.files : []);
    return response.result;
  } finally {
    // Keep the last observed state after a partial model run, without adopting unrelated edits.
    reconcile(run, before, write ? run.plan.files : []);
    if (write) validatePlanPaths(run.project, run.plan, run.dirtyPaths);
    const executionPath = path.join(directory, "execution.json");
    if (existsSync(executionPath)) run.executions.push({ directory, ...JSON.parse(readFileSync(executionPath, "utf8")) });
    save(run);
  }
}
function afterReview(run, source) {
  if (source === "internal-reviewer") move(run, run.plan.ui ? "ui-review" : "external-review");
  else if (source === "ui-ux") move(run, "external-review");
  else move(run, "complete");
}
function acceptReview(run, source, report) {
  if (source === "internal-reviewer") { run.internalReview = report; run.internalSnapshot = run.codeState.id; }
  else if (source === "ui-ux") { run.uiReview = report; run.uiSnapshot = run.codeState.id; }
  else { run.externalReview = report; run.externalSnapshot = run.codeState.id; }
  save(run);
}
function repair(run, findings) { run.pendingFindings = findings; clearEvidence(run); move(run, "repair"); }
export function completionReady(run) {
  const id = run.codeState.id;
  return run.approval?.hash === planHash(run) && run.validation?.length === run.plan.checks.length &&
    run.validation.every((check) => check.status === "PASS") && run.validationSnapshot === id &&
    pass(run.internalReview) && run.internalSnapshot === id &&
    (!run.plan.ui || (pass(run.uiReview) && run.uiSnapshot === id)) &&
    run.externalReview && run.externalSnapshot === id && !run.externalFindings?.length &&
    (!run.externalReview.conditions || pass(run.externalReview));
}
function checkVisualEvidence(run) {
  if (!run.plan.ui) return;
  for (const filename of run.plan.visualEvidence) {
    const absolute = safePath(run.project, filename);
    const saved = run.visualEvidence?.find((item) => item.path === filename);
    if (!saved || saved.codeState !== run.codeState.id || !existsSync(absolute) || digest(readFileSync(absolute)) !== saved.hash) throw new Error(`UI evidence is missing or stale: ${filename}`);
  }
}
export function createRun(request, cwd = process.cwd(), profileFile) {
  if (!request.trim()) throw new Error("Request must not be empty.");
  const project = projectRoot(cwd);
  if (stateRoot() === project || stateRoot().startsWith(`${project}${path.sep}`)) throw new Error("PLANAGENT_STATE_DIR must be outside the target repository.");
  const baseHead = git(project, ["rev-parse", "HEAD"]).trim();
  const baseline = snapshot(project);
  const run = { id: randomUUID(), project, request, feedback: [], createdAt: new Date().toISOString(),
    baseHead, baseline, codeState: baseline, dirtyPaths: dirtyPaths(project), profile: readProfile(profileFile),
    status: "ready", stage: "plan", counters: { calls: 0, repairs: 0, internal: 0, external: 0, ui: 0 }, executions: [] };
  save(run); record(run, "created"); return run;
}
export function approveRun(run, hash) {
  if (run.stage !== "approval" || run.status !== "waiting_approval" || hash !== planHash(run)) throw new Error("Approval must match the current displayed plan and waiting run.");
  if (run.plan.questions.length) throw new Error("Resolve planning questions before approval.");
  if (snapshot(run.project).id !== run.codeState.id || git(run.project, ["rev-parse", "HEAD"]).trim() !== run.baseHead) throw new Error("Project changed after planning. Revise the plan before approval.");
  run.approval = { hash, at: new Date().toISOString(), source: "explicit-cli-approval" };
  writeJson(path.join(runDirectory(run.id), "approval.json"), run.approval);
  run.status = "ready"; move(run, "implement"); record(run, "approved", { hash });
}
export function reviseRun(run, feedback) {
  if (!feedback.trim()) throw new Error("Feedback must not be empty.");
  if (["completed", "cancelled"].includes(run.status)) throw new Error(`Cannot revise a ${run.status} run.`);
  if (run.implementationStarted) {
    const current = snapshot(run.project);
    const allowed = [...run.plan.files, ...run.plan.visualEvidence];
    if (git(run.project, ["rev-parse", "HEAD"]).trim() !== run.baseHead || changedPaths(run.codeState, current).some((file) => !allowed.includes(file))) throw new Error("Resolve unrelated changes or HEAD changes before revising an active task.");
    run.codeState = current;
    run.alreadyChangedFiles = changedPaths(run.baseline, current).filter((file) => !run.dirtyPaths.includes(file) && !run.plan.visualEvidence.includes(file));
  } else {
    run.baseline = snapshot(run.project); run.codeState = run.baseline;
    run.baseHead = git(run.project, ["rev-parse", "HEAD"]).trim(); run.dirtyPaths = dirtyPaths(run.project);
  }
  record(run, "revision", { feedback, previousApproval: run.approval, previousPlan: run.plan });
  run.priorPlan = run.plan;
  run.feedback.push(feedback); delete run.plan; delete run.uiDesign; delete run.approval;
  clearEvidence(run); delete run.externalFindings; delete run.pendingFindings; delete run.pendingReview; delete run.clarification;
  run.status = "ready"; move(run, "plan");
}
async function approval(run, signal) {
  process.stdout.write(showPlan(run));
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await terminal.question("Approve this exact plan and its validation commands? [y/N] ", { signal });
    if (answer.trim().toLowerCase() === "y") { approveRun(run, planHash(run)); return true; }
    return false;
  } finally { terminal.close(); }
}

export async function execute(run, approveHash) {
  const release = acquire(run.project, run.id);
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.on("SIGINT", abort); process.on("SIGTERM", abort); process.on("SIGHUP", abort);
  const cancellation = path.join(runDirectory(run.id), "cancel.request");
  const watch = setInterval(() => { if (existsSync(cancellation)) controller.abort(); }, 500);
  try {
    // Reload under the project lock so two commands cannot act on stale state.
    run = load(run.id);
    if (run.status === "completed") {
      if (snapshot(run.project).id !== run.codeState.id) throw new Error("Completed run's code state has changed; its evidence is historical. Start a new run.");
      return run;
    }
    if (run.status === "cancelled") return run;
    if (existsSync(cancellation)) { run.status = "cancelled"; save(run); return run; }
    if (approveHash) approveRun(run, approveHash);
    if (git(run.project, ["rev-parse", "HEAD"]).trim() !== run.baseHead) throw new Error("Repository HEAD changed during this run.");
    const current = snapshot(run.project);
    if (current.id !== run.codeState.id) {
      if (!run.approval || changedPaths(run.codeState, current).some((file) => !run.plan.files.includes(file))) throw new Error("Project changed outside this run. Resolve the changes before resuming.");
      run.codeState = current; clearEvidence(run);
      if (!["implement", "repair"].includes(run.stage)) run.stage = "validate";
      record(run, "evidence-invalidated", { reason: "Owned files changed while run was stopped" });
    }
    run.status = "running"; delete run.error; save(run);
    while (!controller.signal.aborted) {
      if (run.approval && run.approval.hash !== planHash(run)) throw new Error("Approved plan was changed; refusing to execute it.");
      if (git(run.project, ["rev-parse", "HEAD"]).trim() !== run.baseHead) throw new Error("Repository HEAD changed during execution.");
      if (snapshot(run.project).id !== run.codeState.id) throw new Error("Concurrent file changes detected; resume only after resolving them.");
      const ids = run.plan?.conditions.map(({ id }) => id) || [];
      if (run.stage === "plan") {
        run.plan = await call(run, "planner", "plan", input(run), controller.signal);
        assertResult("plan", run.plan); validatePlanPaths(run.project, run.plan, run.dirtyPaths);
        if (run.alreadyChangedFiles?.some((file) => !run.plan.files.includes(file))) throw new Error("Revised plan must account for all files already changed by this run.");
        const runtimeRoot = fileURLToPath(new URL("../", import.meta.url));
        if (run.plan.files.some((file) => safePath(run.project, file).startsWith(runtimeRoot))) throw new Error("The running Planagent installation cannot modify itself. Use a separately installed runtime to work on its source.");
        if (run.plan.questions.length) { run.status = "needs_input"; move(run, "approval"); process.stdout.write(showPlan(run)); return run; }
        move(run, run.plan.ui && !run.uiDesign ? "ui-design" : "approval");
      } else if (run.stage === "ui-design") {
        run.uiDesign = await call(run, "ui-ux", "design", input(run), controller.signal);
        move(run, "plan");
      } else if (run.stage === "approval") {
        run.status = run.plan.questions.length ? "needs_input" : "waiting_approval"; save(run);
        writeFileSync(path.join(runDirectory(run.id), "brief.md"), showPlan(run), { mode: 0o600 });
        if (run.plan.questions.length || !(await approval(run, controller.signal))) return run;
        run.status = "running"; save(run);
      } else if (run.stage === "implement" || run.stage === "repair") {
        const isRepair = run.stage === "repair";
        if (!run.approval) throw new Error("Implementation requires approval.");
        if (isRepair) bound(run, "repairs", run.profile.limits.maxRepairs);
        run.implementationStarted = true; save(run);
        const result = await call(run, isRepair ? "repair" : "implementer", "implement", { ...input(run), findings: run.pendingFindings, validationFailure: run.validationFailure }, controller.signal, [], true);
        if (result.blockers.length) throw new Error(`Implementation blocked: ${result.blockers.join("; ")}`);
        run.implementation = result; delete run.validationFailure; clearEvidence(run); move(run, "validate");
      } else if (run.stage === "validate") {
        const directory = path.join(runDirectory(run.id), "validation", randomUUID()); mkdirSync(directory, { recursive: true, mode: 0o700 });
        const before = snapshot(run.project);
        const startedAt = Date.now();
        run.validation = await validate(run.project, run.plan.checks, directory, run.profile.limits.validationTimeoutMs, controller.signal, path.join(runDirectory(run.id), "active-process.json"));
        reconcile(run, before, run.plan.visualEvidence);
        run.validationSnapshot = run.codeState.id; save(run);
        if (run.validation.some((check) => check.reason)) throw new Error("Validation could not execute normally (startup failure, timeout, or cancellation). See validation logs; model repair was not started.");
        if (run.validation.some((check) => check.status !== "PASS")) {
          run.validationFailure = run.validation; repair(run, []);
        } else {
          run.visualEvidence = run.plan.visualEvidence.map((filename) => {
            const absolute = safePath(run.project, filename);
            if (!existsSync(absolute) || statSync(absolute).mtimeMs < startedAt - 1) throw new Error(`Validation must produce fresh UI evidence: ${filename}`);
            return { path: filename, hash: digest(readFileSync(absolute)), codeState: run.codeState.id };
          });
          move(run, "internal-review");
        }
      } else if (["internal-review", "ui-review", "external-review"].includes(run.stage)) {
        const source = run.stage === "internal-review" ? "internal-reviewer" : run.stage === "ui-review" ? "ui-ux" : "reviewer";
        const counter = source === "reviewer" ? "external" : source === "ui-ux" ? "ui" : "internal";
        bound(run, counter, source === "reviewer" ? run.profile.limits.maxExternalReviews : run.profile.limits.maxInternalReviews);
        if (source === "ui-ux") checkVisualEvidence(run);
        const recheck = source === "reviewer" && run.externalFindings?.length;
        const report = await call(run, source, recheck ? "recheck" : "review", { ...input(run), mode: recheck ? "recheck" : "initial", acceptedFindings: recheck ? run.externalFindings : undefined, clarification: run.clarification }, controller.signal, recheck ? run.externalFindings.map(({ id }) => id) : ids);
        delete run.clarification;
        if (recheck) {
          assertCoverage(report.conditions, ids);
          const unresolved = new Set(report.findings.filter((finding) => finding.status !== "RESOLVED").map(({ id }) => id));
          run.externalFindings = run.externalFindings.filter(({ id }) => unresolved.has(id));
          if (run.externalFindings.length) repair(run, run.externalFindings);
          else if (!pass(report)) throw new Error("Recheck left required condition evidence FAIL/UNVERIFIED.");
          else { run.externalReview = report; run.externalSnapshot = run.codeState.id; move(run, "complete"); }
        } else if (report.findings.length) {
          run.pendingReview = { source, report }; move(run, "triage");
        } else if (!pass(report)) throw new Error(`Required conditions remain FAIL/UNVERIFIED in ${source}: ${report.conditions.filter((item) => item.status !== "PASS").map(({ id }) => id).join(", ")}`);
        else { acceptReview(run, source, report); afterReview(run, source); }
      } else if (run.stage === "triage") {
        const { source, report } = run.pendingReview;
        const triage = await call(run, "triager", "triage", { ...input(run), source, report }, controller.signal, report.findings.map(({ id }) => id));
        if (triage.decisions.some(({ decision }) => decision === "uncertain")) throw new Error("Triage requires a decision; see the triager result before resuming.");
        const accepted = report.findings.filter((finding) => triage.decisions.find(({ id }) => id === finding.id).decision === "accept");
        record(run, "triaged", { source, decisions: triage.decisions });
        if (accepted.length) {
          if (source === "reviewer") run.externalFindings = accepted;
          repair(run, accepted);
        } else if (!pass(report)) {
          run.clarification = { report, triage };
          move(run, source === "reviewer" ? "external-review" : source === "ui-ux" ? "ui-review" : "internal-review");
        } else { acceptReview(run, source, report); afterReview(run, source); }
      } else if (run.stage === "complete") {
        checkVisualEvidence(run);
        if (!completionReady(run)) throw new Error("Completion gate failed: required current evidence is missing.");
        run.status = "completed"; run.completedAt = new Date().toISOString();
        const changed = changedPaths(run.baseline, run.codeState);
        writeFileSync(path.join(runDirectory(run.id), "changes.diff"), taskDiff(run.project, run.plan), { mode: 0o600 });
        const summary = `# Completed: ${run.plan.summary}\n\nRun: ${run.id}\nProject: ${run.project}\nCode state: ${run.codeState.id}\n\nChanged files:\n${changed.map((file) => `- ${file}`).join("\n")}\n\nValidation:\n${run.validation.map((check) => `- ${check.id}: ${check.status}`).join("\n")}\n\nCompletion conditions:\n${run.internalReview.conditions.map((item) => `- ${item.id}: ${item.status} — ${item.evidence}`).join("\n")}\n\nIndependent review: completed; no accepted unresolved findings.\nDelivery: local file changes; no commit, push, or deployment.\n`;
        writeFileSync(path.join(runDirectory(run.id), "summary.md"), summary, { mode: 0o600 });
        save(run); record(run, "completed"); process.stdout.write(summary); return run;
      } else throw new Error(`Unknown workflow stage: ${run.stage}`);
    }
    run.status = existsSync(cancellation) ? "cancelled" : "interrupted"; save(run); return run;
  } catch (error) {
    run.status = controller.signal.aborted ? (existsSync(cancellation) ? "cancelled" : "interrupted") : "blocked";
    run.error = error.message; save(run); record(run, "stopped", { status: run.status, reason: run.error });
    return run;
  } finally {
    clearInterval(watch); process.off("SIGINT", abort); process.off("SIGTERM", abort); process.off("SIGHUP", abort); release();
  }
}
