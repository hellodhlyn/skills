import { readFileSync } from "node:fs";
import { readProfile } from "./profile.mjs";
import { parseArgs } from "node:util";

const help = `Planagent — Pi workflow runtime

Usage:
  planagent <command>
  plana     <command>

Commands:
  run "<request>" [--profile FILE]  Plan, approve, implement, validate, review, repair
  run --issue REF ["<request>"]     Read a Linear issue, comments and linked documents
                                  Optional: --document ID_OR_URL (repeatable)
  auth linear                     Connect Linear MCP with read/write OAuth
  linear <command>                Explicit Linear read/comment/status commands
  show <run-id>                    Show the complete plan and approval hash
  approve <run-id> --hash HASH      Approve that exact plan and continue
  revise <run-id> "<feedback>"      Revise a plan and require renewed approval
  refresh <run-id>                 Refresh Linear context and generate a new plan
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

  if (args[0] === "auth" && args[1] === "linear" && args.length === 2) {
    const { loginLinear } = await import("./integrations/linear-mcp.mjs");
    const result = await loginLinear();
    process.stdout.write(`Linear connected (${result.method}). Comments and status changes require explicit commands.\n`);
    return 0;
  }
  if (args[0] === "linear") {
    const { runLinearCli } = await import("./integrations/linear-cli.mjs");
    return runLinearCli(args.slice(1));
  }
  let parsed;
  try { parsed = parseArgs({ args, allowPositionals: true, options: { hash: { type: "string" }, json: { type: "boolean" }, profile: { type: "string" }, issue: { type: "string" }, document: { type: "string", multiple: true } } }); }
  catch (error) { process.stderr.write(`${error.message}\n`); return 2; }
  const { positionals: [command, first, second, ...extra], values } = parsed;
  const counts = { run: values.issue ? [0, 1] : [1], show: [1], approve: [1], revise: [2], refresh: [1], resume: [1], status: [0, 1], cancel: [1] };
  const flags = { run: ["profile", "issue", "document"], approve: ["hash"], status: ["json"] };
  const count = parsed.positionals.length - 1;
  const invalidFlag = Object.entries(values).some(([key, value]) => !(flags[command] || []).includes(key) || (typeof value === "string" && !value.trim()) || (Array.isArray(value) && value.some((item) => !item.trim())));
  if (!counts[command]?.includes(count) || extra.length || invalidFlag || (values.document && !values.issue) || (command === "approve" && !values.hash)) {
    process.stderr.write("Unsupported command or arguments. Run plana --help.\n"); return 2;
  }
  const { createRun, execute, planHash, showPlan, reviseRun, refreshInput } = await import("./workflow.mjs");
  const { load, listRuns, runDirectory, cancel, acquire } = await import("./store.mjs");
  if (command === "status") {
    const runs = first ? [load(first)] : listRuns();
    if (values.json) process.stdout.write(`${JSON.stringify(first ? runs[0] : runs, null, 2)}\n`);
    else for (const run of runs) process.stdout.write(`${run.id}  ${run.status}  ${run.stage}  ${run.project}${run.error ? `\n  ${run.error}` : ""}\n`);
    return 0;
  }
  if (command === "show") { process.stdout.write(showPlan(load(first))); return 0; }
  if (command === "cancel") { const run = cancel(first); process.stdout.write(`${run.id}: cancellation requested\n`); return 0; }
  let run = command === "run" ? createRun(first, process.cwd(), values.profile, { issue: values.issue, documents: values.document }) : load(first);
  if (command === "revise" || command === "refresh") {
    const release = acquire(run.project, run.id);
    try { run = load(run.id); if (command === "refresh") await refreshInput(run); else reviseRun(run, second); } finally { release(); }
  }
  run = await execute(run, command === "approve" ? values.hash : undefined);
  process.stdout.write(`\nRun ${run.id}: ${run.status} (${run.stage})\nArtifacts: ${runDirectory(run.id)}\n`);
  if (run.error) process.stderr.write(`${run.error}\n`);
  if (run.status === "waiting_approval") process.stdout.write(`Continue: plana approve ${run.id} --hash ${planHash(run)}\n`);
  if (run.status === "needs_input") process.stdout.write(`Respond: plana revise ${run.id} "<answers or feedback>"\n`);
  return run.status === "completed" ? 0 : ["interrupted", "cancelled"].includes(run.status) ? 130 : run.status === "blocked" ? 1 : 3;
}
