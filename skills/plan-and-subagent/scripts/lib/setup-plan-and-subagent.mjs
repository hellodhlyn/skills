import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const manifestPath = path.join(repository, "skills/plan-and-subagent/scripts/plan-and-subagent-install.json");
const knownProfiles = JSON.parse(fs.readFileSync(manifestPath, "utf8")).profiles;
const usage = `Usage: bash skills/plan-and-subagent/scripts/setup-plan-and-subagent.sh --check | --dry-run | --apply [options]
  --profile codex|claude  Select the native profile (default: codex).
  --component skill|ui-browser  Component-only selection (environment and opencode are local-only and install nothing).
  --check     Inspect installed files and local runtime readiness (no configuration writes).
  --dry-run   Show the entire file plan and required operations without applying them.
  --apply     Synchronize the skill and UI browser runtime, then check readiness.
  --force     Replace conflicting files after inspecting the dry-run; only with --apply.

Destinations: PLAN_AND_SUBAGENT_CODEX_DIR, PLAN_AND_SUBAGENT_CLAUDE_DIR, PLAN_AND_SUBAGENT_UI_BROWSER_DIR,
PLAN_AND_SUBAGENT_SETUP_DIR. AGENT_ENVIRONMENT_DIR and OPENCODE_CONFIG_DIR are also resolved, but profiles
and agent definitions are local-only files that this installer never writes or removes.
All must be absolute paths.
Exit codes: 0 = passed; 1 = conflict/install/check failure; 2 = setup needs user action.
No command invokes a paid model, changes credentials, or edits local profiles, agent definitions,
global AGENTS.md, or CLAUDE.md.`;

export const requiredProfileHeadings = [
  "Native bindings",
  "Advisor fallback chain",
  "Decision defaults",
  "Auto-proceed policy",
  "Delivery defaults",
  "Drift handling",
  "Project runbooks",
  "Visualization and display",
  "Journal",
  "Language",
  "Installation targets",
];

// Receipt entries from earlier installers whose files are now user-owned local files.
const locallyOwnedComponents = new Set(["profile", "environment", "claude", "codex", "opencode"]);

export function parseArguments(args) {
  const options = { mode: undefined, profile: "codex", component: undefined, force: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (["--check", "--dry-run", "--apply"].includes(arg)) {
      if (options.mode) throw new Error("Choose exactly one mode.");
      options.mode = arg.slice(2);
    } else if (arg === "--profile") {
      options.profile = args[++index];
      if (!knownProfiles.includes(options.profile)) throw new Error("Unknown profile.");
    } else if (arg === "--force") options.force = true;
    else if (arg === "--component") {
      if (options.component) throw new Error("Choose only one component.");
      options.component = args[++index];
      if (!["skill", "environment", "opencode", "ui-browser"].includes(options.component)) throw new Error("Unknown component.");
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.mode) throw new Error("Choose --check, --dry-run, or --apply.");
  if (options.force && options.mode !== "apply") throw new Error("--force requires --apply.");
  return options;
}

export function resolveRoots(env = process.env, home = os.homedir()) {
  const roots = {
    codex: env.PLAN_AND_SUBAGENT_CODEX_DIR || env.CODEX_HOME || path.join(home, ".codex"),
    claude: env.PLAN_AND_SUBAGENT_CLAUDE_DIR || env.CLAUDE_CONFIG_DIR || path.join(home, ".claude"),
    environment: env.AGENT_ENVIRONMENT_DIR || path.join(home, ".config/agents"),
    opencode: env.OPENCODE_CONFIG_DIR || path.join(home, ".config/opencode"),
    browser: env.PLAN_AND_SUBAGENT_UI_BROWSER_DIR || path.join(home, ".local/share/plan-and-subagent/opencode-ui-browser"),
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
  if (!stat(file)) {
    const empty = { version: 1, files: {} };
    Object.defineProperty(empty, "released", { value: [], enumerable: false });
    return empty;
  }
  const receipt = JSON.parse(fs.readFileSync(file, "utf8"));
  if (receipt.version !== 1 || !receipt.files || typeof receipt.files !== "object" || Array.isArray(receipt.files)) {
    throw new Error(`Invalid installation receipt: ${file}`);
  }
  for (const [target, record] of Object.entries(receipt.files)) {
    if (!path.isAbsolute(target) || typeof record?.component !== "string" || !/^[a-f0-9]{64}$/.test(record?.hash)) {
      throw new Error(`Invalid installation receipt entry: ${file}`);
    }
  }
  // Profiles, agent definitions, and their companions are local files now: stop managing them and never remove them.
  const released = [];
  for (const [target, record] of Object.entries(receipt.files)) {
    if (!locallyOwnedComponents.has(record.component)) continue;
    released.push(target);
    delete receipt.files[target];
  }
  Object.defineProperty(receipt, "released", { value: released, enumerable: false });
  return receipt;
}

function belongsTo(entry, profiles) {
  if (entry.profile) return profiles.includes(entry.profile);
  if (Array.isArray(entry.profiles)) return entry.profiles.some((profile) => profiles.includes(profile));
  return true;
}

function entryMatches(entry, selected, profiles) {
  return selected.includes(entry.component) && belongsTo(entry, profiles);
}

function receiptEntryMatches(manifest, roots, target, record, selected, profiles) {
  if (!selected.includes(record.component)) return false;
  if (record.profile || record.profiles) return belongsTo(record, profiles);
  // Older receipts omit multi-profile ownership; resolve it from the inventory entry that installs this path.
  const owners = manifest.entries.filter((entry) => entry.component === record.component && within(joined(roots[entry.root], entry.target), target));
  return owners.length === 0 || owners.some((entry) => belongsTo(entry, profiles));
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
      plan.push({ component: entry.component, profile: entry.profile, profiles: entry.profiles, source: sourceFile, target: targetFile, hash, current, action });
    }
  }
  const stale = new Set();
  for (const [target, entry] of Object.entries(receipt.files)) {
    if (receiptEntryMatches(manifest, roots, target, entry, selected, profiles) && !targets.has(target) && stat(target)) stale.add(target);
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
    receipt.files[entry.target] = {
      component: entry.component,
      ...(entry.profile ? { profile: entry.profile } : {}),
      ...(entry.profiles ? { profiles: entry.profiles } : {}),
      hash: entry.hash,
    };
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

export function profileHeadings(contents) {
  const headings = new Set();
  let fence;
  for (const line of contents.split(/\r?\n/)) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1][0];
      else if (marker[1][0] === fence) fence = undefined;
      continue;
    }
    if (fence) continue;
    const heading = line.match(/^## +(.+?) *#*\s*$/);
    if (heading) headings.add(heading[1]);
  }
  return headings;
}

export function referencedProfiles(contents, home = os.homedir()) {
  const paths = new Set();
  for (const match of contents.matchAll(/(?<![^\s`"'(<\[])(~\/|\/)[^\s`"'()<>\[\]]*PROFILE\.md/g)) {
    paths.add(match[0].startsWith("~/") ? path.join(home, match[0].slice(2)) : path.normalize(match[0]));
  }
  return [...paths];
}

// Generic, environment-independent profile check: the designated PROFILE.md exists and carries every required heading.
export function checkLocalProfile(check, roots, report, home = os.homedir()) {
  const instructions = check.designation.files.map((name) => path.join(roots[check.designation.root], name));
  const active = instructions.find((file) => fs.existsSync(file) && fs.readFileSync(file, "utf8").trim());
  const profiles = active ? referencedProfiles(fs.readFileSync(active, "utf8"), home) : [];
  if (!profiles.length) {
    report("Global profile designation", "ACTION_REQUIRED",
      `No absolute or ~-prefixed PROFILE.md path found in ${active || instructions.at(-1)}. Designate your local profile there; it was not edited. See references/profile-interface.md.`);
    return;
  }
  report("Global profile designation", "PASS", `Profile path found in ${active}; effective project/task overrides require session inspection.`);
  for (const file of profiles) {
    const info = stat(file);
    if (!info?.isFile()) {
      report("Local profile interface", "ACTION_REQUIRED", `${file} is missing or not a regular file. It was not created.`);
      continue;
    }
    const present = profileHeadings(fs.readFileSync(file, "utf8"));
    const missing = requiredProfileHeadings.filter((heading) => !present.has(heading));
    report("Local profile interface", missing.length ? "ACTION_REQUIRED" : "PASS", missing.length
      ? `${file} is missing H2 heading(s): ${missing.join(", ")}. It was not edited.`
      : `${file} has all ${requiredProfileHeadings.length} required headings; contents and model invocation not tested.`);
  }
}

async function runtimeChecks(manifest, roots, profiles, activeComponents, report, { profileChecks = true } = {}) {
  if (activeComponents.has("ui-browser")) {
    const check = await command("pnpm", ["--dir", roots.browser, "run", "check"]);
    report("UI browser package", check.code === 0 ? "PASS" : "FAIL", check.code === 0 ? "package checks passed" : check.stderr || check.stdout);
    const browser = await command("node", ["--input-type=module", "-e",
      'import {chromium} from "playwright"; const browser=await chromium.launch({headless:true}); const page=await browser.newPage(); await page.setContent("<main>browser-ready</main>"); if(await page.locator("main").textContent()!=="browser-ready") process.exitCode=1; await browser.close();',
    ], { cwd: roots.browser });
    report("UI browser Chromium", browser.code === 0 ? "PASS" : "FAIL", browser.code === 0 ? "real browser capture runtime is available" : browser.stderr || browser.stdout);
  }
  if (!profileChecks) return;
  for (const profile of profiles) {
    const check = manifest.checks?.[profile];
    if (!check) continue;
    checkLocalProfile(check, roots, report);
    if (check.session) report("Session", "NOTICE", check.session);
  }
}

export async function main(args) {
  if (args.includes("--help")) { console.log(usage); return 0; }
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 19)) throw new Error("Setup requires Node.js 22.19 or later.");
  const options = parseArguments(args);
  if (["environment", "opencode"].includes(options.component)) {
    console.log("Profiles and agent definitions are local-only files now; this installer no longer installs or removes them.");
    return 0;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const roots = resolveRoots();
  const profiles = [options.profile];
  const selected = options.component ? [options.component] : ["skill", "skill-opencode", "ui-browser"];
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
        await requireCommand("gh", ["skill", "install", repository, entry.skill, "--from-local", "--agent", entry.agent || "codex", "--scope", "user", "--dir", staging, "--force"]);
        stagedSkills.set(entry.skill, path.join(staging, entry.skill));
      }
    }
    const plan = buildPlan(manifest, repository, roots, receipt, selected, stagedSkills, profiles);
    const activeComponents = new Set(plan.files.map((entry) => entry.component));
    const sourceLinks = missingLinks(plan.files, true);
    if (sourceLinks.length) throw new Error(`Missing source links:\n${sourceLinks.join("\n")}`);
    const plannedLinks = missingLinks(plan.files, true, true);
    if (plannedLinks.length) throw new Error(`Linked resources are absent from the install plan:\n${plannedLinks.join("\n")}`);
    for (const entry of plan.files.filter((entry) => entry.action !== "unchanged")) console.log(`[${entry.action.toUpperCase()}] ${entry.component}: ${entry.target}`);
    for (const file of receipt.released) report("released to local ownership", "NOTICE", file);
    console.log(`Files: ${plan.files.length}; unchanged: ${plan.files.filter((entry) => entry.action === "unchanged").length}.`);
    for (const file of plan.stale) report("Obsolete managed file (preserved)", "NOTICE", file);
    if (options.mode === "dry-run") {
      if (activeComponents.has("ui-browser")) console.log("Apply: install locked UI browser dependencies and Chromium, then package and browser checks.");
      console.log(`Selected profile(s): ${profiles.join(", ")}. No configuration or receipt was written.`);
      return plan.files.some((entry) => entry.action === "conflict") ? 1 : 0;
    }
    if (options.mode === "apply") {
      if (activeComponents.has("ui-browser")) await requireCommand("pnpm", ["--version"]);
      applyPlan(plan, receipt, receiptPath, options.force);
      report("Managed file writes", "PASS", `${plan.files.length} files synchronized; receipt recorded in ${receiptPath}${receipt.released.length ? `; ${receipt.released.length} entries released to local ownership (files untouched)` : ""}.`);
      if (activeComponents.has("ui-browser")) {
        console.log("Installing locked UI browser dependencies...");
        await requireCommand("pnpm", ["--dir", roots.browser, "install", "--frozen-lockfile", "--prod"], { timeout: 300_000 });
        console.log("Installing Playwright Chromium...");
        await requireCommand("node", [path.join(roots.browser, "node_modules/playwright/cli.js"), "install", "chromium"], { timeout: 300_000 });
      }
    }
    const mismatches = plan.files.filter((entry) => !stat(entry.target) || digest(entry.target) !== entry.hash);
    report("File synchronization", mismatches.length ? "FAIL" : "PASS", mismatches.length ? `${mismatches.length} file(s) missing or different; run --dry-run.` : `${plan.files.length} managed files match the source.`);
    const links = missingLinks(plan.files);
    report("Linked documents", links.length ? "FAIL" : "PASS", links.join("\n"));
    await runtimeChecks(manifest, roots, profiles, activeComponents, report, { profileChecks: !options.component });
    console.log(options.component ? `Component-only result: ${options.component}; full environment readiness was not checked.` : "Local checks complete; no paid model invocation was performed.");
    return exitCode;
  } catch (error) {
    console.error(`[FAIL] ${error.message}`);
    console.error(`Setup is incomplete; later installation/readiness stages were not completed. See ${receiptPath} for recorded file changes, fix the reported issue and rerun. Local profiles and agent definitions are never modified.`);
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
