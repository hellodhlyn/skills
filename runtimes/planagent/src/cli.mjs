import { readFileSync } from "node:fs";
import { readProfile } from "./profile.mjs";
import { parseArgs } from "node:util";

const help = `Planagent — Pi workflow runtime

Usage:
  planagent <command>
  plana     <command>

Commands:
  run "<request>" [--profile FILE]  Plan, approve, implement, validate, review, repair
  show <run-id>                    Show the complete plan and approval hash
  approve <run-id> --hash HASH      Approve that exact plan and continue
  revise <run-id> "<feedback>"      Revise a plan and require renewed approval
  resume <run-id>                  Resume an interrupted or blocked run
  status [run-id] [--json]          Inspect saved progress and execution evidence
  cancel <run-id>                  Cancel a run and its active process
  models                          Show configured role models
  -h, --help       Show this help
  -v, --version    Show the package version

planagent and plana are equivalent commands.
run uses the current Git repository and requires Pi authentication.
Without a terminal it saves the plan and waits for explicit hash-bound approval.
Exit codes: 0 completed/info, 1 blocked, 2 invalid arguments, 3 waiting, 130 interrupted.
`;

export async function runCli(args) {
  if (args.length === 0 || (args.length === 1 && ["-h", "--help"].includes(args[0]))) {
    process.stdout.write(help);
    return 0;
  }

  if (args.length === 1 && ["-v", "--version"].includes(args[0])) {
    const metadata = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    process.stdout.write(`planagent ${metadata.version}\n`);
    return 0;
  }

  if (args.length === 1 && args[0] === "models") {
    for (const [role, { provider, model, thinking }] of Object.entries(readProfile().roles)) {
      process.stdout.write(`${role.padEnd(19)} ${provider}/${model} (${thinking})\n`);
    }
    return 0;
  }

  let parsed;
  try { parsed = parseArgs({ args, allowPositionals: true, options: { hash: { type: "string" }, json: { type: "boolean" }, profile: { type: "string" } } }); }
  catch (error) { process.stderr.write(`${error.message}\n`); return 2; }
  const { positionals: [command, first, second, ...extra], values } = parsed;
  const counts = { run: [1], show: [1], approve: [1], revise: [2], resume: [1], status: [0, 1], cancel: [1] };
  const count = parsed.positionals.length - 1;
  if (!counts[command]?.includes(count) || extra.length || (values.hash && command !== "approve") || (values.json && command !== "status") || (values.profile && command !== "run") || (command === "approve" && !values.hash)) {
    process.stderr.write("Unsupported command or arguments. Run plana --help.\n"); return 2;
  }
  const { createRun, execute, planHash, showPlan, reviseRun } = await import("./workflow.mjs");
  const { load, listRuns, runDirectory, cancel, acquire } = await import("./store.mjs");
  if (command === "status") {
    const runs = first ? [load(first)] : listRuns();
    if (values.json) process.stdout.write(`${JSON.stringify(first ? runs[0] : runs, null, 2)}\n`);
    else for (const run of runs) process.stdout.write(`${run.id}  ${run.status}  ${run.stage}  ${run.project}${run.error ? `\n  ${run.error}` : ""}\n`);
    return 0;
  }
  if (command === "show") { process.stdout.write(showPlan(load(first))); return 0; }
  if (command === "cancel") { const run = cancel(first); process.stdout.write(`${run.id}: cancellation requested\n`); return 0; }
  let run = command === "run" ? createRun(first, process.cwd(), values.profile) : load(first);
  if (command === "revise") {
    const release = acquire(run.project, run.id);
    try { run = load(run.id); reviseRun(run, second); } finally { release(); }
  }
  run = await execute(run, command === "approve" ? values.hash : undefined);
  process.stdout.write(`\nRun ${run.id}: ${run.status} (${run.stage})\nArtifacts: ${runDirectory(run.id)}\n`);
  if (run.error) process.stderr.write(`${run.error}\n`);
  if (run.status === "waiting_approval") process.stdout.write(`Continue: plana approve ${run.id} --hash ${planHash(run)}\n`);
  if (run.status === "needs_input") process.stdout.write(`Respond: plana revise ${run.id} "<answers or feedback>"\n`);
  return run.status === "completed" ? 0 : ["interrupted", "cancelled"].includes(run.status) ? 130 : run.status === "blocked" ? 1 : 3;
}
