import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const manifestPath = path.join(repository, "skills/plan-and-subagent/scripts/plan-and-subagent-install.json");
const usage = `Usage: bash skills/plan-and-subagent/scripts/setup-plan-and-subagent.sh --check | --dry-run | --apply [options]
  --profile codex|glm|both  Select the native profile (default: codex).
  --component environment|opencode|pi  Compatibility component-only selection.
  --check     Inspect installed files and local runtime readiness (no configuration writes).
  --dry-run   Show the entire file plan and required operations without applying them.
  --apply     Synchronize the selected profile, then check readiness.
  --force     Replace conflicting files after inspecting the dry-run; only with --apply.
  --with-browser  Install Chromium for the Pi-only compatibility entry point.

Destinations: PLAN_AND_SUBAGENT_CODEX_DIR, AGENT_ENVIRONMENT_DIR, OPENCODE_CONFIG_DIR,
PI_UI_VERIFIER_DIR, PLAN_AND_SUBAGENT_SETUP_DIR. All must be absolute paths.
Exit codes: 0 = passed; 1 = conflict/install/check failure; 2 = setup needs user action.
No command invokes a paid model, changes credentials, or edits global AGENTS.md.`;

export function parseArguments(args) {
  const options = { mode: undefined, profile: "codex", component: undefined, force: false, withBrowser: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (["--check", "--dry-run", "--apply"].includes(arg)) {
      if (options.mode) throw new Error("Choose exactly one mode.");
      options.mode = arg.slice(2);
    } else if (arg === "--profile") {
      options.profile = args[++index];
      if (!["codex", "glm", "both"].includes(options.profile)) throw new Error("Unknown profile.");
    } else if (arg === "--force") options.force = true;
    else if (arg === "--with-browser") options.withBrowser = true;
    else if (arg === "--component") {
      if (options.component) throw new Error("Choose only one component.");
      options.component = args[++index];
      if (!["environment", "opencode", "pi"].includes(options.component)) throw new Error("Unknown component.");
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.mode) throw new Error("Choose --check, --dry-run, or --apply.");
  if (options.force && options.mode !== "apply") throw new Error("--force requires --apply.");
  if (options.withBrowser && options.mode !== "apply") throw new Error("--with-browser requires --apply.");
  return options;
}

export function resolveRoots(env = process.env, home = os.homedir()) {
  const roots = {
    codex: env.PLAN_AND_SUBAGENT_CODEX_DIR || env.CODEX_HOME || path.join(home, ".codex"),
    environment: env.AGENT_ENVIRONMENT_DIR || path.join(home, ".config/agents"),
    opencode: env.OPENCODE_CONFIG_DIR || path.join(home, ".config/opencode"),
    legacyOpencode: env.OPENCODE_LEGACY_CONFIG_DIR || path.join(home, ".opencode"),
    pi: env.PI_UI_VERIFIER_DIR || path.join(home, ".local/share/plan-and-subagent/pi-ui-verifier"),
    state: env.PLAN_AND_SUBAGENT_SETUP_DIR || path.join(home, ".local/share/plan-and-subagent/setup"),
  };
  for (const [name, value] of Object.entries(roots)) {
    if (!path.isAbsolute(value)) throw new Error(`${name} destination must be absolute: ${value}`);
    roots[name] = path.resolve(value);
  }
  return roots;
}

function stat(file) {
  try { return fs.lstatSync(file); } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

function within(root, file) {
  const relative = path.relative(root, file);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function joined(root, relative) {
  const file = path.resolve(root, relative);
  if (path.isAbsolute(relative) || !within(root, file)) throw new Error(`Path escapes its root: ${relative}`);
  return file;
}

export function assertSafeDestination(file) {
  const info = stat(file);
  if (info && !info.isFile()) throw new Error(`Refusing non-regular destination: ${file}`);
  let parent = path.dirname(file);
  while (true) {
    const info = stat(parent);
    if (info && !info.isDirectory()) throw new Error(`Refusing non-directory or symlink parent: ${parent}`);
    const next = path.dirname(parent);
    if (next === parent) break;
    parent = next;
  }
}

function filesUnder(source) {
  const info = stat(source);
  if (!info) throw new Error(`Missing source: ${source}`);
  if (info.isFile()) return [source];
  if (!info.isDirectory()) throw new Error(`Refusing non-regular source: ${source}`);
  return fs.readdirSync(source).filter((name) => ![".git", "node_modules"].includes(name)).sort()
    .flatMap((name) => filesUnder(path.join(source, name)));
}

function digest(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

export function loadReceipt(file) {
  assertSafeDestination(file);
  if (!stat(file)) return { version: 1, files: {} };
  const receipt = JSON.parse(fs.readFileSync(file, "utf8"));
  if (receipt.version !== 1 || !receipt.files || typeof receipt.files !== "object" || Array.isArray(receipt.files)) {
    throw new Error(`Invalid installation receipt: ${file}`);
  }
  for (const [target, record] of Object.entries(receipt.files)) {
    if (!path.isAbsolute(target) || typeof record?.component !== "string" || !/^[a-f0-9]{64}$/.test(record?.hash)) {
      throw new Error(`Invalid installation receipt entry: ${file}`);
    }
  }
  return receipt;
}

function entryMatches(entry, selected, profiles) {
  if (!selected.includes(entry.component)) return false;
  if (entry.profile) return profiles.includes(entry.profile);
  if (Array.isArray(entry.profiles)) return entry.profiles.some((profile) => profiles.includes(profile));
  return true;
}

export function buildPlan(manifest, repo, roots, receipt, selected, stagedSkills = new Map(), profiles = ["codex"]) {
  const plan = [];
  const targets = new Set();
  for (const entry of manifest.entries.filter((candidate) => entryMatches(candidate, selected, profiles))) {
    const original = joined(repo, entry.source);
    const originalFiles = filesUnder(original);
    const source = stagedSkills.get(entry.skill) || original;
    const target = joined(roots[entry.root], entry.target);
    for (const originalFile of originalFiles) {
      const relative = path.relative(original, originalFile);
      const sourceFile = relative ? path.join(source, relative) : source;
      const targetFile = relative ? path.join(target, relative) : target;
      if (within(repo, targetFile) || within(targetFile, repo)) throw new Error(`Destination overlaps repository: ${targetFile}`);
      if (targets.has(targetFile)) throw new Error(`Duplicate destination: ${targetFile}`);
      targets.add(targetFile);
      assertSafeDestination(targetFile);
      const hash = digest(sourceFile);
      const current = stat(targetFile) ? digest(targetFile) : undefined;
      const previous = receipt.files[targetFile];
      const action = current === hash ? "unchanged" : !current ? "add"
        : previous?.component === entry.component && current === previous.hash ? "update" : "conflict";
      plan.push({ component: entry.component, profile: entry.profile, source: sourceFile, target: targetFile, hash, current, action });
    }
  }
  const stale = new Set();
  for (const [target, entry] of Object.entries(receipt.files)) {
    if (selected.includes(entry.component) && !targets.has(target) && stat(target)) stale.add(target);
  }
  for (const entry of manifest.retired || []) {
    if (entryMatches(entry, selected, profiles)) {
      const target = joined(roots[entry.root], entry.target);
      if (stat(target)) stale.add(target);
    }
  }
  return { files: plan, stale: [...stale] };
}

function saveReceipt(file, receipt) {
  writeAtomic(file, `${JSON.stringify(receipt, null, 2)}\n`, 0o600);
}

function writeAtomic(file, contents, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, contents, { flag: "wx", mode });
  try { fs.renameSync(temporary, file); }
  finally { fs.rmSync(temporary, { force: true }); }
}

export function applyPlan(plan, receipt, receiptPath, force = false) {
  assertSafeDestination(receiptPath);
  if (!force && plan.files.some((entry) => entry.action === "conflict")) throw new Error("Conflicts remain; inspect --dry-run before --apply --force.");
  for (const entry of plan.files) {
    assertSafeDestination(entry.target);
    const current = stat(entry.target) ? digest(entry.target) : undefined;
    if (current !== entry.current || digest(entry.source) !== entry.hash) throw new Error(`File changed during setup: ${entry.target}`);
  }
  saveReceipt(receiptPath, receipt);
  for (const entry of plan.files) {
    assertSafeDestination(entry.target);
    const current = stat(entry.target) ? digest(entry.target) : undefined;
    if (current !== entry.current) throw new Error(`File changed during setup: ${entry.target}`);
    if (entry.action !== "unchanged") writeAtomic(entry.target, fs.readFileSync(entry.source), 0o644);
    receipt.files[entry.target] = { component: entry.component, ...(entry.profile ? { profile: entry.profile } : {}), hash: entry.hash };
    saveReceipt(receiptPath, receipt);
  }
}

export function missingLinks(files, useSource = false, planned = false) {
  const missing = [];
  const destinations = new Set(files.map((entry) => entry.target));
  for (const entry of files) {
    const file = useSource ? entry.source : entry.target;
    if (!file.endsWith(".md")) continue;
    if (!stat(file)) { missing.push(`Missing document: ${file}`); continue; }
    const contents = fs.readFileSync(file, "utf8");
    for (const match of contents.matchAll(/\]\(([^\s)]+)\)/g)) {
      const link = match[1];
      if (/^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(link)) continue;
      const target = path.resolve(path.dirname(planned ? entry.target : file), link.split("#")[0]);
      if (!(planned && destinations.has(target)) && !stat(target)) missing.push(`${planned ? entry.target : file} -> ${link}`);
    }
  }
  return missing;
}

export async function command(binary, args, { cwd = repository, env = process.env, timeout = 60_000 } = {}) {
  return new Promise((resolve) => {
    const processGroup = process.platform !== "win32";
    const child = spawn(binary, args, { cwd, env, detached: processGroup, stdio: ["ignore", "pipe", "pipe"] });
    const terminate = (signal) => {
      if (!child.pid) return;
      try {
        if (processGroup) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch (error) { if (error.code !== "ESRCH") stderr += error.message; }
    };
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; terminate("SIGTERM"); }, timeout);
    const killTimer = setTimeout(() => terminate("SIGKILL"), timeout + 5_000);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { stderr += error.message; });
    child.on("close", (code) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      if (timedOut) { terminate("SIGKILL"); stderr += `\nCommand timed out after ${timeout}ms.`; }
      resolve({ code: timedOut ? 1 : code ?? 1, stdout, stderr, timedOut });
    });
  });
}

async function requireCommand(binary, args, options) {
  const result = await command(binary, args, options);
  if (result.code !== 0 || result.timedOut) {
    throw new Error(`${binary} ${args.join(" ")} failed${result.timedOut ? " (timeout)" : ` (exit ${result.code})`}:\n${result.stderr || result.stdout}`);
  }
  return result;
}

async function runtimeChecks(roots, profiles, selected, report) {
  if (selected.includes("opencode")) {
    const checks = [];
    if (profiles.includes("codex")) checks.push({
      name: "OpenCode agent discovery (Codex)",
      env: process.env,
      pattern: /^reviewer(?:\s|$)/m,
    });
    if (profiles.includes("glm")) checks.push({
      name: "OpenCode agent discovery (GLM)",
      env: { ...process.env, OPENCODE_CONFIG: path.join(roots.opencode, "profiles/glm/opencode.jsonc") },
      pattern: /^glm-orchestrator(?:\s|$)/m,
    });
    for (const check of checks) {
      const result = await command("mise", ["exec", "--", "opencode", "agent", "list"], { env: check.env });
      const clean = result.stdout.replace(/\x1b\[[0-9;]*m/g, "");
      const found = result.code === 0 && check.pattern.test(clean);
      report(check.name, found ? "PASS" : "FAIL", found ? "configured agent found; model invocation not tested" : result.stderr || result.stdout);
    }
  }
  if (profiles.includes("glm") && selected.includes("opencode")) {
    const config = path.join(roots.opencode, "profiles/glm/opencode.jsonc");
    report("GLM native profile", stat(config) ? "PASS" : "FAIL", stat(config) ? `${config} is installed; model invocation not tested` : `Missing ${config}`);
  }
  if (selected.includes("pi")) {
    const check = await command("mise", ["exec", "--", "pnpm", "--dir", roots.pi, "run", "check"]);
    report("Pi package checks", check.code === 0 ? "PASS" : "FAIL", check.code === 0 ? "package checks passed; browser checked separately" : check.stderr || check.stdout);
    const browser = await command("mise", ["exec", "--", "node", "--input-type=module", "-e",
      'import {chromium} from "playwright"; import {spawnSync} from "node:child_process"; const r=spawnSync(process.execPath,["--test","test/browser-smoke.test.mjs"],{stdio:"inherit",env:{...process.env,PI_UI_VERIFIER_BROWSER_EXECUTABLE:chromium.executablePath()}}); process.exit(r.status ?? 1);',
    ], { cwd: roots.pi });
    report("Chromium capture and audit", browser.code === 0 ? "PASS" : "FAIL", browser.code === 0 ? "real browser smoke test passed" : browser.stderr || browser.stdout);
    const auth = await command("mise", ["exec", "--", path.join(roots.pi, "node_modules/.bin/pi"), "auth", "check", "--provider", "opencode-go", "--model", "glm-5.3-flash", "--json", "--no-refresh"]);
    let status;
    try { status = JSON.parse(auth.stdout); } catch { /* Do not print auth output, even on failure. */ }
    const ready = auth.code === 0 && status?.status === "ready" && status.provider === "opencode-go";
    const missing = status?.provider === "opencode-go" && status?.status === "not_ready" && status?.reason === "credentials_not_configured";
    report("Pi authentication", ready ? "PASS" : missing ? "ACTION_REQUIRED" : "FAIL", ready
      ? "credential check passed; model invocation not tested"
      : missing ? "Credentials are not configured. Credentials were not changed."
      : "Authentication/model check failed or returned an invalid result; credential output was suppressed.");
  }
  if (profiles.includes("codex") && selected.includes("profile")) {
    const instructions = ["AGENTS.override.md", "AGENTS.md"].map((name) => path.join(roots.codex, name));
    const active = instructions.find((file) => fs.existsSync(file) && fs.readFileSync(file, "utf8").trim());
    const expected = path.join(roots.environment, "profiles/codex/PROFILE.md");
    const contents = active ? fs.readFileSync(active, "utf8").replaceAll("`", "").replaceAll("~/", `${os.homedir()}/`) : "";
    report("Global profile designation", contents.includes(expected) ? "PASS" : "ACTION_REQUIRED", contents.includes(expected)
      ? `Profile path found in ${active}; effective project/task overrides require session inspection.`
      : `Designate ${expected} in the active global AGENTS.md. It was not edited.`);
    report("Codex session", "NOTICE", "Start a new Codex session after role updates; current-session discovery cannot be verified by this installer.");
  }
}

export async function main(args) {
  if (args.includes("--help")) { console.log(usage); return 0; }
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 19)) throw new Error("Setup requires Node.js 22.19 or later through mise.");
  const options = parseArguments(args);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const roots = resolveRoots();
  const profiles = options.profile === "both" ? ["codex", "glm"] : [options.profile];
  const selected = options.component
    ? options.component === "environment" ? ["profile", "environment"] : [options.component]
    : ["skill", "skill-opencode", "profile", "environment", "codex", "opencode", "pi"];
  const receiptPath = path.join(roots.state, "receipt.json");
  if (within(repository, receiptPath)) throw new Error("Installation receipt must be outside the repository.");
  const receipt = loadReceipt(receiptPath);
  let staging;
  let exitCode = 0;
  const report = (name, status, detail = "") => {
    console.log(`[${status}] ${name}${detail ? `: ${detail.trim()}` : ""}`);
    if (status === "FAIL") exitCode = 1;
    else if (status === "ACTION_REQUIRED" && exitCode === 0) exitCode = 2;
  };
  try {
    const stagedSkills = new Map();
    if (selected.includes("skill")) {
      staging = fs.mkdtempSync(path.join(os.tmpdir(), "plan-and-subagent-setup-"));
      for (const entry of manifest.entries.filter((candidate) => candidate.skill && entryMatches(candidate, selected, profiles))) {
        if (stagedSkills.has(entry.skill)) continue;
        await requireCommand("gh", ["skill", "install", repository, entry.skill, "--from-local", "--agent", "codex", "--scope", "user", "--dir", staging, "--force"]);
        stagedSkills.set(entry.skill, path.join(staging, entry.skill));
      }
    }
    const plan = buildPlan(manifest, repository, roots, receipt, selected, stagedSkills, profiles);
    const sourceLinks = missingLinks(plan.files, true);
    if (sourceLinks.length) throw new Error(`Missing source links:\n${sourceLinks.join("\n")}`);
    const plannedLinks = missingLinks(plan.files, true, true);
    if (plannedLinks.length) throw new Error(`Linked resources are absent from the install plan:\n${plannedLinks.join("\n")}`);
    for (const entry of plan.files.filter((entry) => entry.action !== "unchanged")) console.log(`[${entry.action.toUpperCase()}] ${entry.component}: ${entry.target}`);
    console.log(`Files: ${plan.files.length}; unchanged: ${plan.files.filter((entry) => entry.action === "unchanged").length}.`);
    for (const file of plan.stale) report("Obsolete managed file (preserved)", "NOTICE", file);
    if (options.mode === "dry-run") {
      if (selected.includes("pi")) console.log(`Apply: install locked Pi dependencies${!options.component || options.withBrowser ? " and Chromium" : " (Chromium requires --with-browser for Pi-only install)"}, then package/browser/auth checks.`);
      console.log(`Selected profile(s): ${profiles.join(", ")}. No configuration or receipt was written.`);
      return plan.files.some((entry) => entry.action === "conflict") ? 1 : 0;
    }
    if (options.mode === "apply") {
      if (selected.includes("pi")) await requireCommand("mise", ["exec", "--", "pnpm", "--version"]);
      if (selected.includes("opencode")) await requireCommand("mise", ["exec", "--", "opencode", "--version"]);
      applyPlan(plan, receipt, receiptPath, options.force);
      report("Managed file writes", "PASS", `${plan.files.length} files synchronized and recorded in ${receiptPath}.`);
      if (selected.includes("pi")) {
        console.log("Installing locked Pi dependencies...");
        await requireCommand("mise", ["exec", "--", "pnpm", "--dir", roots.pi, "install", "--frozen-lockfile", "--prod"], { timeout: 300_000 });
        if (!options.component || options.withBrowser) {
          console.log("Installing Playwright Chromium...");
          await requireCommand("mise", ["exec", "--", "node", path.join(roots.pi, "node_modules/playwright/cli.js"), "install", "chromium"], { timeout: 300_000 });
        }
      }
    }
    const mismatches = plan.files.filter((entry) => !stat(entry.target) || digest(entry.target) !== entry.hash);
    report("File synchronization", mismatches.length ? "FAIL" : "PASS", mismatches.length ? `${mismatches.length} file(s) missing or different; run --dry-run.` : `${plan.files.length} managed files match the source.`);
    const links = missingLinks(plan.files);
    report("Linked documents", links.length ? "FAIL" : "PASS", links.join("\n"));
    await runtimeChecks(roots, profiles, selected, report);
    console.log(options.component ? `Component-only result: ${options.component}; full environment readiness was not checked.` : "Local checks complete; no paid model invocation was performed.");
    return exitCode;
  } catch (error) {
    console.error(`[FAIL] ${error.message}`);
    console.error(`Setup is incomplete; later installation/readiness stages were not completed. See ${receiptPath} for recorded file writes, fix the reported issue and rerun. Unrelated/obsolete files were not removed.`);
    return 1;
  } finally {
    if (staging) fs.rmSync(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(error.message);
    console.error(usage);
    process.exitCode = 1;
  });
}
