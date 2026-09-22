import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import path from "node:path";
import { digest } from "./repository.mjs";

export function stateRoot() { return path.resolve(process.env.PLANAGENT_STATE_DIR || path.join(homedir(), ".local/state/planagent")); }
export function runDirectory(id) {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error("Invalid run ID.");
  return path.join(stateRoot(), "runs", id);
}
export function writeJson(filename, value) {
  mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, filename);
}
export function readJson(filename) { return JSON.parse(readFileSync(filename, "utf8")); }
export function save(run) { run.updatedAt = new Date().toISOString(); writeJson(path.join(runDirectory(run.id), "run.json"), run); }
export function load(id) { return readJson(path.join(runDirectory(id), "run.json")); }
export function record(run, event, data = {}) {
  appendFileSync(path.join(runDirectory(run.id), "events.jsonl"), `${JSON.stringify({ at: new Date().toISOString(), event, ...data })}\n`, { mode: 0o600 });
}
export function listRuns() {
  const directory = path.join(stateRoot(), "runs");
  return existsSync(directory) ? readdirSync(directory).map(load).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
}
function alive(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error("Invalid recorded process identity.");
  try { process.kill(pid, 0); return true; } catch (error) { return error.code !== "ESRCH"; }
}
export function acquire(project, id) {
  const directory = path.join(stateRoot(), "locks");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const filename = path.join(directory, `${digest(project)}.json`);
  const owner = { pid: process.pid, host: hostname(), run: id, token: randomUUID() };
  if (existsSync(filename)) {
    const existing = readJson(filename);
    if (existing.host !== hostname() || alive(existing.pid)) throw new Error(`Project is locked by run ${existing.run} (PID ${existing.pid}).`);
    const activePath = path.join(runDirectory(existing.run), "active-process.json");
    if (existsSync(activePath)) {
      const active = readJson(activePath);
      if (active.status === "running" && alive(active.pid)) throw new Error(`Previous run ${existing.run} still has a live child process (${active.pid}). Wait for it to exit before resuming.`);
    }
    unlinkSync(filename);
  }
  writeFileSync(filename, JSON.stringify(owner), { flag: "wx", mode: 0o600 });
  return () => { if (existsSync(filename) && readJson(filename).token === owner.token) unlinkSync(filename); };
}
export function cancel(id) {
  const run = load(id);
  if (["completed", "cancelled"].includes(run.status)) throw new Error(`Run is already ${run.status}.`);
  writeFileSync(path.join(runDirectory(id), "cancel.request"), "cancel\n", { mode: 0o600 });
  let release;
  try { release = acquire(run.project, id); } catch { return run; }
  try { const current = load(id); current.status = "cancelled"; save(current); return current; } finally { release(); }
}
