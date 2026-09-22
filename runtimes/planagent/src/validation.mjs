import { spawn } from "node:child_process";
import { createWriteStream, readFileSync } from "node:fs";
import { finished } from "node:stream/promises";
import path from "node:path";
import { writeJson } from "./store.mjs";

export async function validate(project, checks, directory, timeoutMs, signal, activePath) {
  const results = [];
  for (let index = 0; index < checks.length; index++) {
    if (signal.aborted) throw new Error("Validation cancelled.");
    const check = checks[index];
    const stdoutPath = path.join(directory, `${index + 1}.stdout.log`);
    const stderrPath = path.join(directory, `${index + 1}.stderr.log`);
    process.stderr.write(`[validate] ${check.argv.join(" ")}\n`);
    const stdout = createWriteStream(stdoutPath, { mode: 0o600 });
    const stderr = createWriteStream(stderrPath, { mode: 0o600 });
    const result = await new Promise((resolve) => {
      const child = spawn(check.argv[0], check.argv.slice(1), { cwd: project, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" });
      if (activePath && child.pid) writeJson(activePath, { status: "running", pid: child.pid, check: check.id });
      let reason, killTimer;
      const kill = (signalName) => { try { if (process.platform === "win32") child.kill(signalName); else if (child.pid) process.kill(-child.pid, signalName); } catch {} };
      const stop = (message) => { reason ??= message; kill("SIGTERM"); killTimer ??= setTimeout(() => kill("SIGKILL"), 3_000); };
      const abort = () => stop("cancelled");
      const timer = setTimeout(() => stop("timeout"), timeoutMs);
      signal.addEventListener("abort", abort, { once: true });
      child.stdout.pipe(stdout); child.stderr.pipe(stderr);
      child.once("error", (error) => { reason = error.message; });
      child.once("close", (code, exitSignal) => {
        clearTimeout(timer); clearTimeout(killTimer); signal.removeEventListener("abort", abort);
        resolve({ id: check.id, argv: check.argv, exitCode: code, signal: exitSignal, status: code === 0 && !reason ? "PASS" : "FAIL", reason, stdoutPath, stderrPath });
      });
      if (signal.aborted) abort();
    });
    await Promise.all([finished(stdout), finished(stderr)]);
    if (activePath) writeJson(activePath, { status: "stopped", check: check.id });
    result.stdoutTail = readFileSync(stdoutPath, "utf8").slice(-6000);
    result.stderrTail = readFileSync(stderrPath, "utf8").slice(-6000);
    results.push(result);
  }
  writeJson(path.join(directory, "results.json"), results);
  return results;
}
