import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import path from "node:path";

export const digest = (value) => createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest("hex");
export function git(project, args) {
  return execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: project, encoding: "utf8", maxBuffer: 30 * 1024 * 1024 });
}
export function projectRoot(cwd) {
  return realpathSync(git(cwd, ["rev-parse", "--show-toplevel"]).trim());
}
export function safePath(project, relative) {
  project = realpathSync(project);
  if (typeof relative !== "string" || !relative || path.isAbsolute(relative) || relative.includes("\0") || relative.includes("\\")) {
    throw new Error(`Expected a project-relative path: ${relative}`);
  }
  const segments = relative.split("/");
  if (segments.some((segment) => ["", ".", "..", ".git"].includes(segment))) throw new Error(`Unsafe project path: ${relative}`);
  const absolute = path.resolve(project, relative);
  let parent = absolute;
  while (true) {
    try { lstatSync(parent); break; }
    catch (error) { if (error.code !== "ENOENT" || parent === path.dirname(parent)) throw error; parent = path.dirname(parent); }
  }
  const real = realpathSync(parent);
  if (real !== project && !real.startsWith(`${project}${path.sep}`)) throw new Error(`Path escapes project through a symlink: ${relative}`);
  return absolute;
}
export function snapshot(project) {
  const paths = [...new Set(git(project, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"]).split("\0").filter(Boolean))].sort();
  const files = {};
  for (const name of paths) {
    const absolute = path.join(project, name);
    let stat;
    try { stat = lstatSync(absolute); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    if (stat.isSymbolicLink()) files[name] = { hash: digest(readlinkSync(absolute)), kind: "link" };
    else if (stat.isFile()) files[name] = { hash: digest(readFileSync(absolute)), executable: Boolean(stat.mode & 0o111) };
    else throw new Error(`Unsupported tracked path (including submodules): ${name}`);
  }
  return { id: digest(files), files };
}
export function changedPaths(before, after) {
  return [...new Set([...Object.keys(before.files), ...Object.keys(after.files)])].filter((name) => JSON.stringify(before.files[name]) !== JSON.stringify(after.files[name])).sort();
}
export function dirtyPaths(project) {
  return [...new Set([
    ...git(project, ["diff", "HEAD", "--name-only", "--no-renames", "-z"]).split("\0"),
    ...git(project, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0"),
  ].filter(Boolean))];
}
export function validatePlanPaths(project, plan, dirty) {
  for (const file of plan.files) {
    safePath(project, file);
    if (dirty.includes(file)) throw new Error(`Plan overlaps a pre-existing change: ${file}. Resolve ownership before starting a new run.`);
    try {
      git(project, ["check-ignore", "-q", "--", file]);
      throw new Error(`Task files must not be ignored by Git: ${file}`);
    } catch (error) { if (error.status !== 1) throw error; }
  }
  for (const file of plan.visualEvidence) safePath(project, file);
}
export function taskDiff(project, plan) {
  let result = git(project, ["diff", "HEAD", "--no-ext-diff", "--no-textconv", "--", ...plan.files]);
  const untracked = new Set(git(project, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0"));
  for (const file of plan.files.filter((file) => untracked.has(file))) {
    const absolute = safePath(project, file);
    result += `\n--- NEW FILE: ${file} ---\n${readFileSync(absolute, "utf8")}\n`;
  }
  return result;
}
export function projectInstructions(project, files = []) {
  const directories = new Set([project]);
  for (const file of files) {
    let current = path.dirname(path.join(project, file));
    while (current.startsWith(`${project}${path.sep}`)) { directories.add(current); current = path.dirname(current); }
  }
  return [...directories].sort().flatMap((directory) => {
    const filename = ["AGENTS.override.md", "AGENTS.md", "CLAUDE.md"].map((name) => path.join(directory, name)).find(existsSync);
    return filename ? [`${path.relative(project, filename)}:\n${readFileSync(filename, "utf8")}`] : [];
  }).join("\n\n");
}
