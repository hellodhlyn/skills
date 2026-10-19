import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { loadRequestFile } from "./opencode-ui-browser/src/request.mjs";

const [workdir, promptFile, runDirectory, model, effort, ...extra] = process.argv.slice(2);
if (!workdir || !promptFile || !runDirectory || !model || !effort
    || (extra.length && (extra.length !== 2 || extra[0] !== "--browser-request"))) {
  console.error("Usage: node run-codex-review.mjs <workdir> <prompt-file> <new-run-dir> <model> <effort> [--browser-request <file>]");
  process.exit(2);
}
// CODEX_BIN pins the CLI when a version manager shim cannot resolve it in the workdir.
const codexBin = process.env.CODEX_BIN || "codex";
if (process.env.CODEX_BIN && !path.isAbsolute(codexBin)) {
  console.error("ERROR: CODEX_BIN must be an absolute path.");
  process.exit(2);
}
if (!/^[a-zA-Z0-9._/-]+$/.test(model) || !["low", "medium", "high", "xhigh", "max"].includes(effort)) {
  console.error("ERROR: invalid model or reasoning effort.");
  process.exit(2);
}

async function main() {
  const cwd = realpathSync(workdir);
  let prompt = readFileSync(promptFile, "utf8");
  if (!prompt.trim()) throw new Error("empty prompt");
  const run = path.resolve(runDirectory);
  if (existsSync(run)) throw new Error("run directory already exists; use a fresh directory");
  const parent = realpathSync(path.dirname(run));
  const relative = path.relative(cwd, parent);
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
    throw new Error("review artifacts must be outside the inspected repository");
  }
  let browser;
  if (extra.length) {
    const loaded = loadRequestFile(realpathSync(extra[1]));
    if (realpathSync(loaded.request.workdir) !== cwd) throw new Error("browser request workdir does not match inspected repository");
    if (!["preview", "final", "recheck"].includes(loaded.request.phase)) throw new Error("UI review requires preview, final, or recheck phase");
    const requestParent = realpathSync(path.dirname(loaded.file));
    const requestRelative = path.relative(cwd, requestParent);
    if (requestRelative === "" || (!requestRelative.startsWith(`..${path.sep}`) && requestRelative !== ".." && !path.isAbsolute(requestRelative))) {
      throw new Error("browser request and evidence must be outside the inspected repository");
    }
    const runtime = process.env.PLAN_AND_SUBAGENT_UI_BROWSER_DIR || path.join(os.homedir(), ".local/share/plan-and-subagent/opencode-ui-browser");
    const server = realpathSync(path.join(runtime, "server.mjs"));
    browser = { request: loaded.file, server };
    const instructions = readFileSync(fileURLToPath(new URL("../references/ui-reviewer.md", import.meta.url)), "utf8");
    prompt = `${instructions}\n\nBrowser request: ${loaded.file}\n\n---\n\n${prompt}`;
  }
  mkdirSync(run, { mode: 0o700 });
  writeFileSync(path.join(run, "prompt.md"), prompt, { mode: 0o600 });
  const args = ["exec", "--ignore-user-config", "--ignore-rules", "--ephemeral", "--json",
    "--disable", "multi_agent", "-C", cwd, "-m", model, "-s", "read-only",
    "-c", 'model_provider="openai"', "-c", `model_reasoning_effort="${effort}"`,
    "-c", 'approval_policy="never"', "-c", 'web_search="disabled"',
    "-o", path.join(run, "result.md"), "-"];
  if (browser) {
    // User config is ignored; project configuration must pass the documented isolation check.
    const config = `{ "ui-browser" = { command = ${JSON.stringify(process.execPath)}, args = [${JSON.stringify(browser.server)}], env = { PLAN_AND_SUBAGENT_UI_BROWSER_REQUEST = ${JSON.stringify(browser.request)} }, enabled_tools = ["load_request", "navigate", "viewport", "act", "capture", "audit"], default_tools_approval_mode = "approve", required = true } }`;
    args.splice(args.length - 1, 0, "-c", `mcp_servers=${config}`, "-c", "features.apps=false");
  }
  const metadata = { model, effort, cwd, sandbox: "read-only", codex: codexBin, argv: args,
    ...(browser ? { browser } : {}),
    startedAt: new Date().toISOString(), status: "running" };
  const save = () => writeFileSync(path.join(run, "execution.json"), `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });
  save();
  for (const file of ["events.jsonl", "stderr.log"]) writeFileSync(path.join(run, file), "", { mode: 0o600 });
  console.error(`Codex independent analysis directory: ${run}`);
  let events = "";
  let stderr = "";
  let interrupted;
  const outcome = await new Promise((resolve) => {
    const grouped = process.platform !== "win32";
    const child = spawn(codexBin, args, { cwd, detached: grouped, stdio: ["pipe", "pipe", "pipe"] });
    Object.assign(metadata, { runnerPid: process.pid, childPid: child.pid ?? null });
    save();
    let killTimer;
    const stop = (signal) => {
      if (!child.pid) return;
      try {
        if (grouped) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch (error) { if (error.code !== "ESRCH") stderr += `${error.message}\n`; }
    };
    const interrupt = (signal) => {
      interrupted ??= signal;
      stop("SIGTERM");
      killTimer ??= setTimeout(() => stop("SIGKILL"), 5000);
      killTimer.unref();
    };
    const onTerm = () => interrupt("SIGTERM");
    const onInt = () => interrupt("SIGINT");
    process.on("SIGTERM", onTerm);
    process.on("SIGINT", onInt);
    child.stdout.on("data", (chunk) => { events += chunk; appendFileSync(path.join(run, "events.jsonl"), chunk); });
    child.stderr.on("data", (chunk) => { stderr += chunk; appendFileSync(path.join(run, "stderr.log"), chunk); });
    child.on("error", (error) => { stderr += `${error.message}\n`; });
    child.stdin.on("error", (error) => { if (error.code !== "EPIPE") stderr += `${error.message}\n`; });
    child.on("close", (code, signal) => {
      clearTimeout(killTimer);
      if (interrupted) stop("SIGKILL");
      process.removeListener("SIGTERM", onTerm);
      process.removeListener("SIGINT", onInt);
      resolve({ code: code ?? 1, signal });
    });
    child.stdin.end(prompt);
  });
  writeFileSync(path.join(run, "events.jsonl"), events, { mode: 0o600 });
  writeFileSync(path.join(run, "stderr.log"), stderr, { mode: 0o600 });
  let report = "";
  if (existsSync(path.join(run, "result.md"))) report = readFileSync(path.join(run, "result.md"), "utf8");
  let parsed;
  try { parsed = events.split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line)); }
  catch { parsed = []; }
  const complete = parsed.some((event) => event.type === "turn.completed");
  const failed = parsed.some((event) => event.type === "turn.failed" || event.type === "error");
  const status = interrupted ? interrupted === "SIGINT" ? 130 : 143
    : outcome.code || (!complete || failed || !report.trim() ? 3 : 0);
  Object.assign(metadata, { finishedAt: new Date().toISOString(), cliExitCode: outcome.code,
    signal: interrupted ?? outcome.signal, exitCode: status, status: status === 0 ? "complete" : "failed",
    threadId: parsed.find((event) => event.type === "thread.started")?.thread_id ?? null,
    usage: parsed.findLast((event) => event.type === "turn.completed")?.usage ?? null });
  save();
  writeFileSync(path.join(run, "exit-code"), `${status}\n`, { mode: 0o600 });
  if (status === 0) process.stdout.write(report);
  else console.error(`ERROR: independent analysis failed (exit ${status}); inspect ${path.join(run, "stderr.log")}.`);
  process.exitCode = status;
}

main().catch((error) => { console.error(`ERROR: ${error.message}`); process.exitCode = 1; });
