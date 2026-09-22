import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertResult } from "../contracts.mjs";
import { writeJson } from "../store.mjs";

export function piExecutable() {
  const entry = fileURLToPath(import.meta.resolve("@earendil-works/pi-coding-agent"));
  const root = resolve(dirname(entry), "..");
  return resolve(root, JSON.parse(readFileSync(join(root, "package.json"), "utf8")).bin.pi);
}

export async function runStage({ project, directory, activePath, role, kind, model, prompt, writable = [], evidencePaths = [], expectedIds = [], timeoutMs, signal }) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const requestPath = join(directory, "request.json");
  writeJson(requestPath, { project, kind, writable, evidencePaths, expectedIds });
  writeFileSync(join(directory, "prompt.md"), prompt, { mode: 0o600 });
  const stderrPath = join(directory, "stderr.log");
  writeFileSync(stderrPath, "", { mode: 0o600 });
  const system = readFileSync(new URL(`../../agents/${role}.md`, import.meta.url), "utf8");
  const extension = fileURLToPath(new URL("../../extensions/stage.mjs", import.meta.url));
  const tools = ["read", "grep", "find", "ls", "submit_result", ...(writable.length ? ["write", "edit", "remove_file"] : [])];
  const args = [piExecutable(), "--mode", "rpc", "--no-session", "--no-approve", "--no-context-files", "--no-extensions", "--no-skills", "--no-prompt-templates", "--no-themes",
    "--provider", model.provider, "--model", model.model, "--thinking", model.thinking,
    "--tools", tools.join(","), "--extension", extension, "--system-prompt", system];
  const execution = { role, kind, provider: model.provider, model: model.model, thinking: model.thinking, startedAt: new Date().toISOString(), settled: false, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, tools: [] };
  process.stderr.write(`[${role}] ${model.provider}/${model.model}\n`);
  try {
    const result = await new Promise((resolveStage, reject) => {
      const child = spawn(process.execPath, args, { cwd: project, env: { ...process.env, PLANAGENT_STAGE_REQUEST: requestPath }, stdio: ["pipe", "pipe", "pipe"] });
      if (activePath && child.pid) writeJson(activePath, { status: "running", pid: child.pid, role, startedAt: execution.startedAt });
      let buffer = "", result, failure, lastStopReason, lastErrorMessage, killTimer;
      const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
      const stop = (error) => {
        failure ??= error;
        child.kill("SIGTERM");
        if (killTimer) clearTimeout(killTimer);
        killTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
      };
      const abort = () => stop(new Error("Stage cancelled."));
      const timer = setTimeout(() => stop(new Error(`Stage exceeded ${timeoutMs / 1000}s.`)), timeoutMs);
      signal?.addEventListener("abort", abort, { once: true });
      const cleanup = () => { clearTimeout(timer); clearTimeout(killTimer); signal?.removeEventListener("abort", abort); };
      child.stderr.on("data", (chunk) => appendFileSync(stderrPath, chunk));
      child.stdin.on("error", (error) => { if (error.code !== "EPIPE") stop(error); });
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        buffer += chunk;
        if (buffer.length > 16 * 1024 * 1024) return stop(new Error("Pi event exceeded 16 MiB."));
        let index;
        while ((index = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, index).trim(); buffer = buffer.slice(index + 1);
          if (!line || failure) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "response") {
              if (!event.success) throw new Error(`Pi ${event.command} failed: ${event.error}`);
              if (event.id === "state") {
                const actual = event.data;
                if (actual.model?.provider !== model.provider || actual.model?.id !== model.model || actual.thinkingLevel !== model.thinking) throw new Error("Pi selected a different model or thinking level.");
                execution.sessionId = actual.sessionId;
                send({ id: "prompt", type: "prompt", message: prompt });
              }
            }
            if (event.type === "tool_execution_start") {
              execution.tools.push(event.toolName);
              process.stderr.write(`  ${event.toolName}\n`);
            }
            if (event.type === "tool_execution_end" && event.toolName === "submit_result" && !event.isError) result = assertResult(kind, event.result?.details?.planagentResult, expectedIds);
            if (event.type === "message_end" && event.message?.role === "assistant") {
              lastStopReason = event.message.stopReason;
              lastErrorMessage = event.message.errorMessage;
              execution.stopReason = lastStopReason;
              if (lastErrorMessage) execution.providerError = String(lastErrorMessage).slice(0, 4000);
              for (const key of Object.keys(execution.usage)) execution.usage[key] += event.message.usage?.[key] || 0;
            }
            if (event.type === "agent_settled") {
              if (!result && lastStopReason === "stop" && !execution.resultReminders) {
                execution.resultReminders = 1;
                process.stderr.write("  requesting structured result\n");
                send({ id: "result-reminder", type: "prompt", message: "Your previous response did not call submit_result. The workflow cannot use a plain-text answer. Submit your completed work now by calling the submit_result tool with its exact schema. Do not repeat the work or claim additional checks." });
                continue;
              }
              execution.settled = true;
              if (!result || ["error", "aborted"].includes(lastStopReason)) throw new Error(lastErrorMessage
                ? `Pi ${role} failed: ${String(lastErrorMessage).slice(0, 4000)}`
                : "Pi settled without a successful structured result.");
              child.stdin.end();
              killTimer ??= setTimeout(() => stop(new Error("Pi did not exit after settlement.")), 5_000);
            }
          } catch (error) { stop(error); }
        }
      });
      child.once("error", (error) => { cleanup(); reject(error); });
      child.once("close", (code, exitSignal) => {
        cleanup(); execution.exitCode = code; execution.signal = exitSignal;
        if (failure) reject(failure);
        else if (code !== 0 || !execution.settled || !result) reject(new Error(`Pi failed (exit ${code}, signal ${exitSignal || "none"}). See ${stderrPath}`));
        else resolveStage(result);
      });
      if (signal?.aborted) abort(); else send({ id: "state", type: "get_state" });
    });
    execution.status = "completed";
    writeJson(join(directory, "result.json"), result);
    return { result, execution, directory };
  } catch (error) {
    execution.status = "failed"; execution.error = error.message; throw error;
  } finally {
    execution.completedAt = new Date().toISOString();
    writeJson(join(directory, "execution.json"), execution);
    if (activePath) writeJson(activePath, { status: execution.status, role, completedAt: execution.completedAt });
  }
}
