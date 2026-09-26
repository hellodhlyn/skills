import {
  closeSync,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  watch,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STEP_LABELS = [
  "환경·작업 확정",
  "결정·브리프 준비",
  "브리프 승인",
  "이해 확인·구현 위임",
  "구현·결과 확인",
  "검증·리뷰",
  "전달·보고",
];

const IMAGE_RE = /\.(?:jpe?g|png)$/i;
const RUN_OUTPUTS = new Set(["output.json", "events.jsonl", "exit-code", "result.md"]);
const MAX_TEXT_BYTES = 4 * 1024 * 1024;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const WEB_DIR = path.join(SCRIPT_DIR, "web");

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

export function safeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0") || value.includes("\\") || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) return null;
  if (value.split("/").some((part) => part === "..")) return null;
  const normalized = path.posix.normalize(value.replaceAll("\\", "/"));
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) return null;
  return normalized;
}

export function resolveInside(root, relative, { mustExist = true } = {}) {
  const safe = safeRelativePath(relative);
  if (!safe) return null;
  const candidate = path.resolve(root, ...safe.split("/"));
  if (!inside(root, candidate)) return null;
  try {
    const real = mustExist ? realpathSync(candidate) : path.resolve(candidate);
    if (!inside(root, real)) return null;
    return real;
  } catch {
    return null;
  }
}

function readSmallText(file, limit = MAX_TEXT_BYTES) {
  try {
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.size > limit) return null;
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

export function validateStatus(input) {
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "JSON root must be an object" };
  if (input.schema !== 1) errors.push("schema must be 1");
  if (typeof input.updatedAt !== "string" || !Number.isFinite(Date.parse(input.updatedAt))) errors.push("updatedAt must be an ISO 8601 timestamp");
  else if (!/^\d{4}-\d\d-\d\dT/.test(input.updatedAt)) errors.push("updatedAt must be an ISO 8601 timestamp");
  if (!Number.isInteger(input.stage) || input.stage < 1 || input.stage > 7) errors.push("stage must be an integer from 1 to 7");
  if (!["user", "agent", "none"].includes(input.waitingOn)) errors.push("waitingOn must be user, agent, or none");
  if (typeof input.summary !== "string" || !input.summary.trim()) errors.push("summary must be a non-empty string");

  if (input.nextAction !== undefined && typeof input.nextAction !== "string") errors.push("nextAction must be a string");
  if (input.userDecision !== undefined) {
    const decision = input.userDecision;
    if (!decision || typeof decision !== "object" || Array.isArray(decision) || typeof decision.question !== "string" || !Array.isArray(decision.options) || !decision.options.every((option) => typeof option === "string")) errors.push("userDecision must contain a question and string options");
  }
  if (input.activeRuns !== undefined) {
    if (!Array.isArray(input.activeRuns) || !input.activeRuns.every((run) => run && typeof run === "object" && typeof run.runDir === "string" && safeRelativePath(run.runDir) !== null && typeof run.agent === "string" && typeof run.role === "string" && typeof run.startedAt === "string" && Number.isFinite(Date.parse(run.startedAt)))) errors.push("activeRuns entries must contain a relative runDir, agent, role, and ISO startedAt");
  }
  if (input.focus !== undefined && (!Array.isArray(input.focus) || !input.focus.every((focus) => focus && typeof focus === "object" && typeof focus.path === "string" && safeRelativePath(focus.path) !== null && (focus.note === undefined || typeof focus.note === "string")))) errors.push("focus entries must contain a relative path and optional note");
  return errors.length ? { ok: false, error: errors.join("; ") } : { ok: true, value: input };
}

export function readStatus(sessionDir) {
  const file = path.join(sessionDir, "status.json");
  try {
    if (!lstatSync(file).isFile()) return { kind: "error", error: "status.json is not a regular file" };
  } catch (error) {
    return error?.code === "ENOENT" ? { kind: "missing" } : { kind: "error", error: "status.json could not be read" };
  }
  let content;
  try { content = readFileSync(file, "utf8"); }
  catch { return { kind: "error", error: "status.json could not be read" }; }
  let parsed;
  try { parsed = JSON.parse(content); }
  catch (error) { return { kind: "error", error: `invalid JSON${Number.isInteger(error?.position) ? ` at character ${error.position}` : ""}` }; }
  const result = validateStatus(parsed);
  return result.ok ? { kind: "valid", value: result.value } : { kind: "error", error: result.error };
}

function listTree(sessionDir) {
  const files = [];
  const visit = (directory) => {
    let entries;
    try { entries = readdirSync(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const full = path.join(directory, entry.name);
      try {
        const stat = lstatSync(full);
        if (stat.isSymbolicLink()) continue;
        if (stat.isDirectory()) visit(full);
        else if (stat.isFile()) {
          const relative = path.relative(sessionDir, full).split(path.sep).join("/");
          files.push({ full, path: relative, size: stat.size, mtimeMs: stat.mtimeMs, mtime: stat.mtime.toISOString() });
        }
      } catch { /* A concurrently removed or unreadable entry is omitted. */ }
    }
  };
  visit(sessionDir);
  return files;
}

function dateFromName(name) {
  const match = name.match(/^(\d{4}-\d{2}-\d{2})-/);
  return match?.[1] ?? "";
}

function sessionTitle(sessionDir) {
  const markdown = readSmallText(path.join(sessionDir, "session.md"), 512 * 1024);
  return markdown?.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
}

function recentRelative(ms, now) {
  const diff = Math.max(0, now - ms);
  if (diff < 60_000) return "방금 전";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}

export function listSessions(root, now = Date.now()) {
  const rootReal = realpathSync(root);
  const rows = [];
  for (const entry of readdirSync(rootReal, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const sessionDir = path.join(rootReal, entry.name);
    let real;
    try { real = realpathSync(sessionDir); } catch { continue; }
    if (!inside(rootReal, real)) continue;
    const files = listTree(real);
    const status = readStatus(real);
    const maxMtime = files.reduce((max, file) => Math.max(max, file.mtimeMs), 0);
    const statusValue = status.kind === "valid" ? status.value : null;
    const activeRuns = statusValue?.activeRuns ?? [];
    let group = "recent";
    if (statusValue?.waitingOn === "user") group = "waiting";
    else if (statusValue?.waitingOn === "agent" || activeRuns.length) group = "active";
    rows.push({
      dir: entry.name,
      title: sessionTitle(real) ?? "session.md 제목 없음",
      slug: entry.name.replace(/^\d{4}-\d{2}-\d{2}-/, ""),
      date: dateFromName(entry.name),
      group,
      statusKind: status.kind,
      status: statusValue,
      statusError: status.kind === "error" ? status.error : null,
      finalSummary: files.some((file) => file.path === "final_summary.md"),
      lastActivity: maxMtime ? new Date(maxMtime).toISOString() : null,
      activityMs: maxMtime,
      relativeActivity: maxMtime ? recentRelative(maxMtime, now) : "활동 시각 없음",
    });
  }
  rows.sort((a, b) => b.activityMs - a.activityMs || a.dir.localeCompare(b.dir));
  const groups = {
    waiting: rows.filter((row) => row.group === "waiting"),
    active: rows.filter((row) => row.group === "active"),
    recent: rows.filter((row) => row.group === "recent"),
  };
  return { sessions: rows, groups, waitingCount: groups.waiting.length };
}

function dimensions(file) {
  let fd;
  try {
    fd = openSync(file, "r");
    const stat = fstatSync(fd);
    const bytes = Buffer.alloc(Math.min(128 * 1024, stat.size));
    readSync(fd, bytes, 0, bytes.length, 0);
    if (bytes[0] === 0x89 && bytes.toString("ascii", 1, 4) === "PNG" && bytes.length >= 24) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      if (!Number.isFinite(length) || length < 2) return null;
      offset += length + 2;
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function extractBriefLinks(files, sessionDir) {
  const briefs = files.filter((file) => /^approved_brief.*\.md$/i.test(path.posix.basename(file.path)));
  const linked = [];
  for (const brief of briefs) {
    const text = readSmallText(brief.full, 2 * 1024 * 1024);
    if (!text) continue;
    const targets = new Set();
    const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
    for (const match of text.matchAll(linkPattern)) {
      let target = match[1].trim().replace(/^<|>$/g, "").split(/[?#]/, 1)[0];
      try { target = decodeURIComponent(target); } catch { continue; }
      if (!IMAGE_RE.test(target)) continue;
      let relative;
      if (/^(?:file:\/\/)?\//i.test(target)) {
        let absolute = target;
        try {
          absolute = /^file:\/\//i.test(target) ? fileURLToPath(target) : decodeURIComponent(target);
          absolute = realpathSync(path.resolve(absolute));
        } catch { continue; }
        if (!inside(sessionDir, absolute)) continue;
        relative = path.relative(sessionDir, absolute).split(path.sep).join("/");
      } else {
        relative = safeRelativePath(target);
      }
      if (relative && resolveInside(sessionDir, relative)) targets.add(relative);
    }
    for (const target of targets) {
      const image = files.find((file) => file.path === target);
      if (!image) continue;
      const size = dimensions(image.full);
      linked.push({ ...image, brief: brief.path, briefCaption: path.posix.basename(brief.path), dimensions: size });
    }
  }
  return linked;
}

function browserRequests(files, sessionDir) {
  return files.filter((file) => /^browser-request(?:-[^/]*)?\.json$/i.test(path.posix.basename(file.path))).map((file) => {
    try {
      const input = JSON.parse(readSmallText(file.full, 2 * 1024 * 1024) ?? "null");
      if (!input || typeof input !== "object") return null;
      let artifactDir = typeof input.artifactDir === "string" ? input.artifactDir : "";
      if (artifactDir.startsWith("file://")) artifactDir = fileURLToPath(artifactDir);
      if (artifactDir && !path.isAbsolute(artifactDir)) artifactDir = path.resolve(sessionDir, artifactDir);
      let resolved = artifactDir ? path.resolve(artifactDir) : "";
      if (resolved) {
        try { resolved = realpathSync(resolved); } catch { /* Keep unresolved request paths unmatched. */ }
      }
      return {
        file: file.path,
        artifactDir: resolved,
        url: typeof input.url === "string" ? input.url : "",
        conditions: Array.isArray(input.conditions) ? input.conditions.filter((condition) => condition && typeof condition.id === "string").map((condition) => ({ id: condition.id, expected: typeof condition.expected === "string" ? condition.expected : "" })) : [],
        viewports: Array.isArray(input.viewports) ? input.viewports.filter((viewport) => viewport && Number.isInteger(viewport.width)).map((viewport) => ({ name: typeof viewport.name === "string" ? viewport.name : String(viewport.width), width: viewport.width, height: Number.isInteger(viewport.height) ? viewport.height : null })) : [],
      };
    } catch { return null; }
  }).filter(Boolean);
}

function auditMap(files) {
  const map = new Map();
  for (const file of files.filter((entry) => /-audit\.json$/i.test(entry.path))) {
    try { map.set(file.path.replace(/-audit\.json$/i, ""), JSON.parse(readSmallText(file.full, 1024 * 1024) ?? "null")); } catch { /* Broken audits remain absent. */ }
  }
  return map;
}

function auditSummary(audit) {
  if (!audit || typeof audit !== "object") return "audit 없음";
  const overflowValue = typeof audit.overflow === "boolean" ? audit.overflow : audit.overflow?.horizontal;
  const overflow = overflowValue === true ? "overflow 있음" : overflowValue === false ? "overflow 없음" : "overflow 미확인";
  const consoleCount = Array.isArray(audit.console) ? audit.console.length : Number.isInteger(audit.console) ? audit.console : 0;
  const errorsCount = Array.isArray(audit.pageErrors) ? audit.pageErrors.length : Number.isInteger(audit.pageErrors) ? audit.pageErrors : 0;
  const axe = Array.isArray(audit.axe) ? audit.axe : [];
  const axeText = axe.length ? `axe ${axe.map((item) => `${item.id ?? "규칙"} (${item.impact ?? "impact 미상"})`).join(", ")}` : "axe 0";
  return `${overflow} · console ${consoleCount} · pageErrors ${errorsCount} · ${axeText}`;
}

function groupImages(files, sessionDir, requests, briefs) {
  const byFolder = new Map();
  for (const file of files.filter((entry) => IMAGE_RE.test(entry.path))) {
    const folder = path.posix.dirname(file.path);
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    const size = dimensions(file.full);
    byFolder.get(folder).push({ ...file, dimensions: size, url: `/file?path=${encodeURIComponent(file.path)}` });
  }
  const briefByPath = new Map(briefs.map((image) => [image.path, image]));
  const audits = auditMap(files);
  const folders = [];
  for (const [folder, images] of byFolder) {
    images.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
    const absoluteFolder = path.resolve(sessionDir, ...folder.split("/"));
    const matching = requests.filter((request) => request.artifactDir === absoluteFolder);
    const groups = [];
    if (!matching.length) {
      groups.push({ id: "unknown", title: "조건 정보 없음", expected: "", audit: "", images: images.map((image) => ({ ...image, briefRef: briefByPath.has(image.path), briefCaption: briefByPath.get(image.path)?.briefCaption ?? "" })) });
    } else {
      for (const request of matching) {
        const conditions = [...request.conditions].sort((a, b) => b.id.length - a.id.length);
        const matched = new Map();
        const unmatched = [];
        for (const image of images) {
          const filename = path.posix.basename(image.path);
          const afterNumber = filename.match(/^\d{3}-(.+)$/)?.[1] ?? "";
          const condition = conditions.find((item) => afterNumber === item.id || afterNumber.startsWith(`${item.id}-`) || afterNumber.startsWith(`${item.id}.`));
          if (!condition) { unmatched.push(image); continue; }
          if (!matched.has(condition.id)) matched.set(condition.id, { condition, images: [] });
          matched.get(condition.id).images.push(image);
        }
        for (const { condition, images: conditionImages } of matched.values()) {
          const auditEntries = conditionImages.map((image) => audits.get(image.path.replace(/\.(?:jpe?g|png)$/i, ""))).filter(Boolean);
          const auditText = auditEntries.length ? auditSummary(auditEntries[0]) : "audit 없음";
          groups.push({
            id: condition.id,
            title: condition.id,
            expected: condition.expected,
            audit: auditText,
            requestFile: request.file,
            viewports: request.viewports,
            images: conditionImages.map((image) => ({ ...image, briefRef: briefByPath.has(image.path), briefCaption: briefByPath.get(image.path)?.briefCaption ?? "", audit: audits.get(image.path.replace(/\.(?:jpe?g|png)$/i, "")) ?? null })),
          });
        }
        if (unmatched.length) groups.push({ id: `unknown-${request.file}`, title: "조건 정보 없음", expected: "", audit: "", images: unmatched.map((image) => ({ ...image, briefRef: briefByPath.has(image.path), briefCaption: briefByPath.get(image.path)?.briefCaption ?? "" })) });
      }
    }
    const newest = images.reduce((max, image) => Math.max(max, image.mtimeMs), 0);
    folders.push({ path: folder, count: images.length, newestAt: newest ? new Date(newest).toISOString() : null, groups });
  }
  folders.sort((a, b) => new Date(b.newestAt ?? 0) - new Date(a.newestAt ?? 0));
  return folders;
}

function runRows(files, sessionDir, status) {
  const dirs = new Map();
  for (const file of files) {
    const dir = path.posix.dirname(file.path);
    if (dir === ".") continue;
    if (!dirs.has(dir)) dirs.set(dir, new Set());
    dirs.get(dir).add(path.posix.basename(file.path));
  }
  const runs = [];
  for (const [dir, names] of dirs) {
    if (!names.has("prompt.md") || ![...RUN_OUTPUTS].some((name) => names.has(name))) continue;
    const base = files.find((file) => file.path === `${dir}/prompt.md`);
    const exitFile = files.find((file) => file.path === `${dir}/exit-code`);
    const exitRaw = exitFile ? readSmallText(exitFile.full, 4096)?.trim() : null;
    const exitExists = Boolean(exitFile);
    const exitCode = exitRaw !== null && /^-?\d+$/.test(exitRaw) ? Number(exitRaw) : null;
    const active = status?.activeRuns?.find((run) => safeRelativePath(run.runDir)?.replace(/\/$/, "") === dir.replace(/\/$/, ""));
    let state;
    if (active && !exitExists) state = { kind: "running", label: "실행 중" };
    else if (active && exitExists) state = { kind: "stale", label: `종료됨 (exit ${exitCode ?? "코드 오류"}) · status.json 미갱신` };
    else if (exitCode === 0) state = { kind: "success", label: "종료 · exit 0" };
    else if (exitCode !== null) state = { kind: "failure", label: `exit ${exitCode}` };
    else if (exitExists) state = { kind: "invalid", label: "종료 코드 오류" };
    else state = { kind: "unknown", label: "종료 코드 없음" };
    const startedAt = active?.startedAt ?? (base ? new Date(base.mtimeMs).toISOString() : null);
    const runRoot = path.resolve(sessionDir, ...dir.split("/"));
    const request = browserRequests(files, sessionDir).find((item) => item.file.startsWith(`${dir}/`) || path.dirname(path.resolve(sessionDir, item.file)) === runRoot);
    const modelsFile = files.find((file) => file.path === `${dir}/models`);
    const modelList = modelsFile ? readSmallText(modelsFile.full, 32 * 1024)?.trim().split(/\r?\n/).filter(Boolean) ?? [] : [];
    const eventsFile = files.find((file) => file.path === `${dir}/events.jsonl`);
    let eventsLastActivity = null;
    if (eventsFile) {
      const eventText = readSmallText(eventsFile.full);
      if (eventText) {
        const observedModels = new Set(modelList);
        for (const line of eventText.split(/\r?\n/)) {
          if (!line) continue;
          let event;
          try { event = JSON.parse(line); } catch { continue; }
          if (typeof event.model === "string") observedModels.add(event.model);
          const inspect = (value) => {
            if (!value || typeof value !== "object") return;
            for (const [key, field] of Object.entries(value)) {
              if (["timestamp", "createdAt", "created_at"].includes(key)) {
                const parsed = typeof field === "number" ? (field < 1_000_000_000_000 ? field * 1000 : field) : Date.parse(String(field));
                if (Number.isFinite(parsed)) eventsLastActivity = Math.max(eventsLastActivity ?? 0, parsed);
              } else if (field && typeof field === "object") inspect(field);
            }
          };
          inspect(event);
        }
        modelList.splice(0, modelList.length, ...observedModels);
      }
    }
    const sessionIdFile = files.find((file) => file.path === `${dir}/session-id` || file.path === `${dir}/thread-id`);
    const runId = sessionIdFile ? readSmallText(sessionIdFile.full, 32 * 1024)?.trim() : null;
    const images = files.filter((file) => file.path.startsWith(`${dir}/`) && IMAGE_RE.test(file.path));
    const fileActivity = files.filter((file) => file.path.startsWith(`${dir}/`)).reduce((max, file) => Math.max(max, file.mtimeMs), 0);
    const lastActivity = eventsLastActivity ?? fileActivity;
    runs.push({
      dir,
      startedAt,
      state,
      exitCode,
      active: Boolean(active),
      agent: active?.agent ?? "",
      role: active?.role ?? "",
      models: modelList,
      model: modelList.join(", "),
      elapsedSeconds: startedAt && Number.isFinite(Date.parse(startedAt)) ? Math.max(0, Math.floor(((exitFile?.mtimeMs ?? Date.now()) - Date.parse(startedAt)) / 1000)) : null,
      lastActivity: lastActivity ? new Date(lastActivity).toISOString() : null,
      imageCount: images.length,
      requestFile: request?.file ?? null,
      request,
      runId,
    });
  }
  runs.sort((a, b) => new Date(b.startedAt ?? 0) - new Date(a.startedAt ?? 0));
  return runs;
}

function documentRows(files, runDirs) {
  const primary = [];
  const grouped = new Map();
  const runPath = (file) => runDirs.some((dir) => file.path.startsWith(`${dir}/`));
  for (const file of files) {
    if (runPath(file)) continue;
    const name = path.posix.basename(file.path);
    const isStatus = name === "status.json" && file.path === name;
    if ((!/\.md$/i.test(name) && !isStatus) || file.path.startsWith(".")) continue;
    const base = name.replace(/\.md$/i, "");
    const isPrimary = ["original_prompt", "decisions", "session", "final_summary"].includes(base) || /^approved_brief(?:.*)?$/.test(base) || isStatus;
    const row = { path: file.path, name, title: isStatus ? "status.json" : base.replaceAll("_", " "), mtime: file.mtime, size: file.size };
    if (isPrimary) primary.push(row);
    else {
      const folder = path.posix.dirname(file.path);
      if (!grouped.has(folder)) grouped.set(folder, []);
      grouped.get(folder).push(row);
    }
  }
  const order = ["original_prompt", "approved_brief", "decisions", "session", "final_summary", "status.json"];
  const rank = (document) => order.indexOf(/^approved_brief.*\.md$/i.test(document.name) ? "approved_brief" : document.name.replace(/\.md$/i, ""));
  primary.sort((a, b) => rank(a) - rank(b)
    || Number(b.name === "approved_brief.md") - Number(a.name === "approved_brief.md")
    || a.path.localeCompare(b.path));
  const groups = [...grouped].map(([folder, docs]) => ({ folder, docs: docs.sort((a, b) => a.path.localeCompare(b.path)) }));
  return { primary, groups };
}

function recentChanges(files, limit = 15) {
  return [...files].sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, limit).map((file) => ({
    path: file.path,
    mtime: file.mtime,
    name: path.posix.basename(file.path),
    kind: IMAGE_RE.test(file.path) ? "image" : /\.html?$/i.test(file.path) ? "html" : /\.md$/i.test(file.path) ? "markdown" : file.path.endsWith("status.json") ? "status" : "file",
    url: IMAGE_RE.test(file.path) ? `/file?path=${encodeURIComponent(file.path)}` : null,
    dimensions: IMAGE_RE.test(file.path) ? dimensions(file.full) : null,
  }));
}

function autoFocus(files, folders) {
  const candidates = [];
  for (const file of files) {
    if (/\.html?$/i.test(file.path) || /^final_summary\.md$/i.test(file.path) || /^session\.md$/i.test(file.path)) candidates.push({ path: file.path, mtimeMs: file.mtimeMs });
  }
  for (const folder of folders) candidates.push({ path: folder.path, mtimeMs: new Date(folder.newestAt ?? 0).getTime(), isFolder: true });
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates.slice(0, 3).map(({ path: focusPath, isFolder }) => ({ path: focusPath, isFolder: Boolean(isFolder) }));
}

export function readSession(root, sessionName, now = Date.now()) {
  const rootReal = realpathSync(root);
  const safeName = safeRelativePath(sessionName);
  if (!safeName || safeName.includes("/")) throw new Error("Invalid session path");
  const sessionDir = resolveInside(rootReal, safeName);
  if (!sessionDir || !lstatSync(sessionDir).isDirectory()) throw new Error("Session does not exist");
  const files = listTree(sessionDir);
  const statusRead = readStatus(sessionDir);
  const status = statusRead.kind === "valid" ? statusRead.value : null;
  const requests = browserRequests(files, sessionDir);
  const briefs = extractBriefLinks(files, sessionDir);
  const folders = groupImages(files, sessionDir, requests, briefs);
  const runs = runRows(files, sessionDir, status);
  const documents = documentRows(files, runs.map((run) => run.dir));
  const sessionFile = path.join(sessionDir, "session.md");
  const sessionText = readSmallText(sessionFile, 2 * 1024 * 1024) ?? "";
  let sessionReadError = null;
  if (!sessionText) {
    try { sessionReadError = lstatSync(sessionFile).size > 2 * 1024 * 1024 ? "session.md가 2 MiB를 초과합니다" : "session.md를 읽을 수 없습니다"; }
    catch { sessionReadError = "session.md가 없습니다"; }
  }
  let lastHeadingIndex = -1;
  let fenced = false;
  let offset = 0;
  for (const line of sessionText.split("\n")) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    else if (!fenced && /^##\s+/.test(line)) lastHeadingIndex = offset;
    offset += line.length + 1;
  }
  const lastSection = lastHeadingIndex >= 0 ? sessionText.slice(lastHeadingIndex).trim() : "";
  const rawFocus = status?.focus?.length ? status.focus : autoFocus(files, folders);
  const focus = rawFocus.map((entry) => {
    const resolvedPath = safeRelativePath(entry.path);
    const absolute = resolvedPath ? resolveInside(sessionDir, resolvedPath) : null;
    const isDocument = Boolean(resolvedPath && /\.(?:md|json|txt|log)$/i.test(resolvedPath));
    const preview = isDocument && absolute
      ? (readSmallText(absolute, 64 * 1024) ?? "").split(/\r?\n/)
        .map((line) => line.replace(/^#{1,6}\s+/, "").trim())
        .find((line) => /[\p{L}\p{N}]/u.test(line)) ?? ""
      : "";
    return { ...entry, resolvedPath: absolute ? resolvedPath : null, preview };
  });
  const mockups = files.filter((file) => /\.html?$/i.test(file.path)).map((file) => {
    const captureRuns = runs.filter((run) => run.request && (() => {
      const url = run.request.url;
      try {
        let pathname = url.startsWith("file://") ? fileURLToPath(url) : path.isAbsolute(url) ? url : "";
        if (pathname) pathname = realpathSync(pathname);
        return pathname && pathname === file.full;
      } catch { return false; }
    })());
    const presets = [...new Set(captureRuns.flatMap((run) => run.request?.viewports ?? []).map((viewport) => viewport.width))].sort((a, b) => a - b);
    return { path: file.path, size: file.size, mtime: file.mtime, captures: captureRuns.map((run) => run.dir), presets };
  });
  const listRow = listSessions(rootReal, now).sessions.find((row) => row.dir === safeName);
  return {
    dir: safeName,
    absolutePath: sessionDir,
    title: sessionTitle(sessionDir) ?? (sessionReadError ?? "session.md에 H1 제목이 없습니다"),
    statusKind: statusRead.kind,
    status,
    statusError: statusRead.kind === "error" ? statusRead.error : null,
    sessionExcerpt: lastSection,
    sessionReadError,
    focus,
    folders,
    briefImages: briefs,
    runs,
    documents,
    mockups,
    recentChanges: recentChanges(files),
    activity: listRow?.lastActivity ?? null,
    hasSession: files.some((file) => file.path === "session.md"),
    hasFinalSummary: listRow?.finalSummary ?? false,
    counts: { images: files.filter((file) => IMAGE_RE.test(file.path)).length, mockups: mockups.length, runs: runs.length, documents: documents.primary.length + documents.groups.reduce((total, group) => total + group.docs.length, 0) },
  };
}

export function readTextFile(root, sessionName, relative) {
  const rootReal = realpathSync(root);
  const sessionNameSafe = safeRelativePath(sessionName);
  if (!sessionNameSafe || sessionNameSafe.includes("/")) throw new Error("Invalid session path");
  const sessionDir = resolveInside(rootReal, sessionNameSafe);
  if (!sessionDir || !lstatSync(sessionDir).isDirectory()) throw new Error("Session does not exist");
  const file = resolveInside(sessionDir, relative);
  if (!file || !lstatSync(file).isFile()) throw new Error("File is outside the session or is not a regular file");
  const stat = lstatSync(file);
  if (stat.size > MAX_TEXT_BYTES) throw new Error("File is too large to display (4 MiB limit)");
  return { path: relative, text: readFileSync(file, "utf8"), mtime: stat.mtime.toISOString(), size: stat.size };
}

export function readBinaryFile(root, sessionName, relative) {
  const rootReal = realpathSync(root);
  const sessionNameSafe = safeRelativePath(sessionName);
  if (!sessionNameSafe || sessionNameSafe.includes("/")) throw new Error("Invalid session path");
  const sessionDir = resolveInside(rootReal, sessionNameSafe);
  if (!sessionDir || !lstatSync(sessionDir).isDirectory()) throw new Error("Session does not exist");
  const file = resolveInside(sessionDir, relative);
  if (!file || !lstatSync(file).isFile()) throw new Error("File is outside the session or is not a regular file");
  return { path: file, stat: lstatSync(file) };
}

export function readRunDetails(root, sessionName, runDir) {
  const details = readSession(root, sessionName);
  const run = details.runs.find((entry) => entry.dir === safeRelativePath(runDir));
  if (!run) throw new Error("Run does not exist");
  const rootReal = realpathSync(root);
  const sessionDir = resolveInside(rootReal, sessionName);
  const read = (name) => {
    try { return { value: readTextFile(root, sessionName, `${run.dir}/${name}`).text, error: null }; }
    catch (error) {
      const candidate = sessionDir ? path.join(sessionDir, ...`${run.dir}/${name}`.split("/")) : "";
      const missing = !candidate || !existsSync(candidate);
      return { value: null, error: missing ? `${name} is missing` : `${name} could not be read` };
    }
  };
  const resultFile = read("result.md");
  const promptFile = read("prompt.md");
  const stderrFile = read("stderr.log");
  const eventsFile = read("events.jsonl");
  let usage = "사용량 정보 없음";
  try {
    const outputFile = read("output.json");
    if (outputFile.value) {
      const parsed = JSON.parse(outputFile.value);
      const modelUsage = parsed.modelUsage;
      if (modelUsage && typeof modelUsage === "object") usage = JSON.stringify(modelUsage);
    }
  } catch { /* Keep the explicit no-usage state when output is malformed. */ }
  if (eventsFile.value && usage === "사용량 정보 없음") {
    const tokenEvents = eventsFile.value.split(/\r?\n/).filter(Boolean).flatMap((line) => {
      try { const item = JSON.parse(line); return item.type === "token_count" || item.type === "turn.completed" ? [item] : []; } catch { return []; }
    });
    if (tokenEvents.length) usage = tokenEvents.map((item) => JSON.stringify(item)).join("\n");
  }
  return {
    run,
    result: resultFile.value,
    resultError: resultFile.error,
    prompt: promptFile.value,
    promptError: promptFile.error,
    stderr: stderrFile.value,
    stderrError: stderrFile.error,
    events: eventsFile.value,
    usage,
    conditions: run.request?.conditions ?? [],
    imageGroups: details.folders.flatMap((folder) => folder.groups.map((group) => ({ title: group.title, expected: group.expected, audit: group.audit, images: group.images.filter((image) => image.path.startsWith(`${run.dir}/`)) })).filter((group) => group.images.length)),
  };
}

export function findMockupCaptures(root, sessionName, mockupPath) {
  const details = readSession(root, sessionName);
  const mockup = details.mockups.find((item) => item.path === safeRelativePath(mockupPath));
  return mockup?.captures ?? [];
}

export function createJournalWatcher(root, onChange, onUnavailable) {
  try {
    const watcher = watch(root, { recursive: true }, (_event, filename) => {
      if (filename === null || filename === undefined) onChange("");
      else onChange(String(filename).split(path.sep).join("/"));
    });
    watcher.on("error", onUnavailable);
    return watcher;
  } catch (error) {
    onUnavailable(error);
    return null;
  }
}
