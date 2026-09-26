import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { spawnSync } from "node:child_process";
import { createServer as createTcpServer } from "node:net";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { createDashboardServer, DEFAULT_PORT } from "../session-dashboard/server.mjs";
import { listSessions, readRunDetails, readSession, readStatus, safeRelativePath, validateStatus } from "../session-dashboard/journal.mjs";
import { renderMarkdown } from "../session-dashboard/markdown.mjs";
import { resolveImageViewport } from "../session-dashboard/web/image-metadata.mjs";
import { imageIndexFor, pathsForSession, shouldRefreshLightbox } from "../session-dashboard/web/lightbox-state.mjs";

const SERVER = new URL("../session-dashboard/server.mjs", import.meta.url);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==", "base64");

function write(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, value);
}

function createJournal() {
  const temp = mkdtempSync(path.join(os.tmpdir(), "session-dashboard-test-"));
  const root = path.join(temp, "journal");
  const session = path.join(root, "2026-09-26-dashboard-fixture");
  const run = "reviews/uiux/mockup-1/run-active";
  const staleRun = "reviews/uiux/mockup-1/run-stale";
  const artifactDir = path.join(session, run, "browser");
  mkdirSync(artifactDir, { recursive: true });
  write(path.join(session, "session.md"), "# Session: Fixture\n\n## First checkpoint\n\nText.\n\n## Last checkpoint\n\nLast section only.\n");
  write(path.join(session, "approved_brief.md"), `[Relative image](${run}/browser/001-I5-1-narrow.jpg)\n\n[Absolute image](${path.join(artifactDir, "002-I5-wide.jpg")})\n\n[Outside image](/etc/passwd.png)\n`);
  write(path.join(session, "approved_brief_notes.md"), `[Note image](${run}/browser/003-I5-1-notes.png)\n`);
  write(path.join(session, "status.json"), JSON.stringify({
    schema: 1,
    updatedAt: "2026-09-26T10:00:00.000Z",
    stage: 5,
    waitingOn: "user",
    summary: "Fixture summary",
    nextAction: "Review the image.",
    userDecision: { question: "Choose one.", options: ["A", "B"] },
    activeRuns: [{ runDir: run, agent: "codex", role: "implementer", startedAt: "2026-09-26T09:55:00.000Z" }, { runDir: staleRun, agent: "claude", role: "reviewer", startedAt: "2026-09-26T09:50:00.000Z" }],
    focus: [{ path: `${run}/browser`, note: "latest capture" }],
  }, null, 2));
  write(path.join(session, run, "browser-request-v2.json"), JSON.stringify({
    artifactDir,
    url: pathToFileURL(path.join(session, "mockups/mock.html")).href,
    conditions: [{ id: "I5", expected: "Base state" }, { id: "I5-1", expected: "Hyphenated condition" }],
    viewports: [{ name: "narrow", width: 320, height: 1000 }],
  }));
  write(path.join(artifactDir, "001-I5-1-narrow.jpg"), PNG);
  write(path.join(artifactDir, "002-I5-wide.jpg"), PNG);
  write(path.join(artifactDir, "003-I5-1-notes.png"), PNG);
  write(path.join(artifactDir, "001-I5-1-narrow-audit.json"), JSON.stringify({ overflow: { horizontal: false }, console: [], pageErrors: [], axe: [{ id: "color-contrast", impact: "serious" }] }));
  write(path.join(session, "approved/unlinked.png"), PNG);
  write(path.join(session, "approved/browser-request-v2.json"), JSON.stringify({ artifactDir: path.join(temp, "elsewhere"), conditions: [{ id: "wrong", expected: "Must not match" }] }));
  write(path.join(session, run, "prompt.md"), "active\n");
  write(path.join(session, run, "events.jsonl"), "{}\n");
  write(path.join(session, run, "models"), "gpt-6-luna\n");
  write(path.join(session, staleRun, "prompt.md"), "stale\n");
  write(path.join(session, staleRun, "exit-code"), "3\n");
  write(path.join(session, "reviews/run-success/prompt.md"), "success\n");
  write(path.join(session, "reviews/run-success/output.json"), "{}\n");
  write(path.join(session, "reviews/run-success/exit-code"), "0\n");
  write(path.join(session, "reviews/run-failure/prompt.md"), "failure\n");
  write(path.join(session, "reviews/run-failure/events.jsonl"), "{}\n");
  write(path.join(session, "reviews/run-failure/exit-code"), "3\n");
  write(path.join(session, "reviews/run-no-exit/prompt.md"), "unknown\n");
  write(path.join(session, "reviews/run-no-exit/result.md"), "No exit file.\n");
  write(path.join(session, "mockups/mock.html"), "<!doctype html><p>Preview</p>");
  write(path.join(session, "references.md"), "# Test\n\n<script>window.attack = true</script>\n\n| Name | State |\n| --- | --- |\n| a | b |\n");
  return { temp, root, session, artifactDir };
}

async function serve(root) {
  const service = createDashboardServer(root, { port: 0, logger: { log() {}, error() {} } });
  await new Promise((resolve, reject) => {
    service.server.once("error", reject);
    service.server.listen(0, "127.0.0.1", resolve);
  });
  const port = service.server.address().port;
  return { ...service, port, base: `http://127.0.0.1:${port}` };
}

test("status.json schema 1 accepts the contract and rejects malformed fields and escaping paths", () => {
  const valid = { schema: 1, updatedAt: "2026-09-26T10:00:00Z", stage: 7, waitingOn: "none", summary: "Done", activeRuns: [{ runDir: "reviews/run-1", agent: "codex", role: "implementer", startedAt: "2026-09-26T09:00:00Z" }], focus: [{ path: "mockups/example.html" }] };
  assert.deepEqual(validateStatus(valid), { ok: true, value: valid });
  assert.match(validateStatus({ ...valid, stage: 8 }).error, /stage/);
  assert.match(validateStatus({ ...valid, waitingOn: "done" }).error, /waitingOn/);
  assert.match(validateStatus({ ...valid, activeRuns: [{ ...valid.activeRuns[0], runDir: "../outside" }] }).error, /relative runDir/);
  assert.match(validateStatus({ ...valid, focus: [{ path: "/outside" }] }).error, /relative path/);
  assert.equal(safeRelativePath("%2e%2e/secret"), "%2e%2e/secret");
  assert.equal(safeRelativePath("../secret"), null);
  assert.equal(safeRelativePath("a/%2e%2e/secret"), "a/%2e%2e/secret");
  assert.equal(safeRelativePath("a/../secret"), null);
});

test("status missing and corrupt states remain distinguishable", (t) => {
  const fixture = createJournal();
  t.after(() => rmSync(fixture.temp, { recursive: true, force: true }));
  const missing = path.join(fixture.root, "2026-09-25-missing");
  mkdirSync(missing);
  assert.deepEqual(readStatus(missing), { kind: "missing" });
  const corrupt = path.join(fixture.root, "2026-09-24-corrupt");
  mkdirSync(corrupt);
  write(path.join(corrupt, "status.json"), "{");
  assert.equal(readStatus(corrupt).kind, "error");
  assert.match(readStatus(corrupt).error, /invalid JSON/);
});

test("journal grouping, run states, condition prefixes, brief links, and approval tags follow the contract", (t) => {
  const fixture = createJournal();
  t.after(() => rmSync(fixture.temp, { recursive: true, force: true }));
  const index = listSessions(fixture.root);
  assert.equal(index.groups.waiting.length, 1);
  assert.equal(index.waitingCount, 1);
  const data = readSession(fixture.root, path.basename(fixture.session));
  assert.equal(data.statusKind, "valid");
  assert.deepEqual(data.documents.primary.slice(0, 2).map((doc) => doc.path), ["approved_brief.md", "approved_brief_notes.md"]);
  assert.equal(data.sessionExcerpt, "## Last checkpoint\n\nLast section only.");
  assert.equal(data.briefImages.length, 3);
  assert.ok(data.briefImages.some((image) => image.path.endsWith("002-I5-wide.jpg")), "absolute path linked from the brief is resolved inside the real journal root");
  assert.equal(new Set(data.briefImages.map((image) => image.brief)).size, 2);
  const folder = data.folders.find((item) => item.path === "reviews/uiux/mockup-1/run-active/browser");
  assert.ok(folder);
  assert.ok(folder.groups.some((group) => group.id === "I5-1" && group.expected === "Hyphenated condition"));
  assert.ok(folder.groups.some((group) => group.id === "I5"));
  assert.ok(folder.groups.find((group) => group.id === "I5-1").audit.includes("axe color-contrast (serious)"));
  const approved = data.folders.find((item) => item.path === "approved");
  assert.equal(approved.groups[0].title, "조건 정보 없음");
  assert.equal(approved.groups[0].images[0].briefRef, false);
  const runs = new Map(data.runs.map((run) => [run.dir, run]));
  assert.equal(runs.get("reviews/uiux/mockup-1/run-active").state.kind, "running");
  assert.equal(runs.get("reviews/uiux/mockup-1/run-stale").state.kind, "stale");
  assert.equal(runs.get("reviews/run-success").state.kind, "success");
  assert.equal(runs.get("reviews/run-failure").state.kind, "failure");
  assert.equal(runs.get("reviews/run-no-exit").state.kind, "unknown");
  assert.equal(data.mockups[0].captures.includes("reviews/uiux/mockup-1/run-active"), true);
  write(path.join(fixture.session, "status.json"), JSON.stringify({ schema: 1, updatedAt: "2026-09-26T10:00:00Z", stage: 5, waitingOn: "user", summary: "Focus preview", focus: [{ path: "status.json" }] }));
  assert.match(readSession(fixture.root, path.basename(fixture.session)).focus[0].preview, /schema/);
  assert.notEqual(readSession(fixture.root, path.basename(fixture.session)).focus[0].preview, "{");
});

test("Markdown escapes raw HTML and renders GFM tables and safe link forms", () => {
  const result = renderMarkdown("<script>alert(1)</script>\n\n| A | B |\n| --- | --- |\n| x | y |\n\n[web](https://example.com)\n\n[Mockup](mockups/mock.html)\n\n![Evidence](browser/001.png)", (target) => {
    if (target.endsWith("mock.html")) return { kind: "route", route: "#/s/2026-09-26-fixture/mockups/mockups%2Fmock.html" };
    if (target.endsWith("001.png")) return { kind: "image", path: "browser/001.png", session: "2026-09-26-fixture", src: "/file?session=fixture&path=browser%2F001.png" };
    return null;
  });
  assert.equal(result.html.includes("<script>"), false);
  assert.match(result.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(result.html, /<table>/);
  assert.match(result.html, /https:\/\/example\.com/);
  assert.match(result.html, /<a href="#\/s\/2026-09-26-fixture\/mockups\/mockups%2Fmock\.html" data-journal-route=/);
  assert.match(result.html, /<button class="markdown-image" type="button" data-image-path="browser\/001\.png" data-image-session="2026-09-26-fixture"/);
  const unsafe = renderMarkdown("[unsafe](link)", () => ({ kind: "route", route: "javascript:alert(1)" }));
  assert.doesNotMatch(unsafe.html, /href="javascript:/);
});

test("Markdown preserves nested ordered and unordered list structure while escaping HTML", () => {
  const result = renderMarkdown("- Parent\n  - Child\n    1. Grandchild\n  - Sibling\n- Next\n\n<script>alert(1)</script>");
  assert.match(result.html, /<ul>\s*<li>Parent\s*<ul>\s*<li>Child\s*<ol>\s*<li>Grandchild\s*<\/li>\s*<\/ol>\s*<\/li>\s*<li>Sibling\s*<\/li>\s*<\/ul>\s*<\/li>\s*<li>Next\s*<\/li>\s*<\/ul>/);
  assert.match(result.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(result.html, /<script>/);
});

test("lightbox viewport metadata resolves one image label and keeps ambiguous values unknown", () => {
  const viewports = [{ name: "narrow", width: 320, height: 1000 }, { name: "desktop", width: 1280, height: 900 }];
  assert.deepEqual(resolveImageViewport("browser/001-I5-1-narrow-sheet-open.jpg", viewports), viewports[0]);
  assert.deepEqual(resolveImageViewport("browser/002-I5-desktop.jpg", viewports), viewports[1]);
  assert.deepEqual(resolveImageViewport("browser/003-I5-1280-scaled.jpg", viewports), viewports[1]);
  assert.equal(resolveImageViewport("browser/004-I5-unlabelled.jpg", viewports), null);
  assert.equal(resolveImageViewport("browser/005-I5-desktop.jpg", [{ name: "desktop", width: 1280 }, { name: "desktop", width: 1440 }]), null);
});

test("lightbox SSE relevance is session-scoped and recognizes image, folder, and request changes", () => {
  const current = { path: "reviews/run/browser/001-mobile.jpg", folder: "reviews/run/browser", session: "fixture", group: { requestFile: "reviews/run/browser-request.json" } };
  const pinned = { path: "mockups/approved/002-reference.jpg", folder: "mockups/approved", session: "fixture", group: {} };
  assert.deepEqual(pathsForSession(["other-session/status.json", "fixture/status.json"], "fixture"), ["status.json"]);
  assert.equal(shouldRefreshLightbox(pathsForSession(["other-session/status.json"], "fixture"), current, pinned), false);
  assert.equal(shouldRefreshLightbox(["status.json", "session.md"], current, pinned), false);
  assert.equal(shouldRefreshLightbox(["reviews/run/browser/001-mobile-audit.json"], current, pinned), true);
  assert.equal(shouldRefreshLightbox(["reviews/run/browser-request.json"], current, pinned), true);
  assert.equal(shouldRefreshLightbox(["reviews/another-run/browser/003-new.jpg"], current, pinned), true);
  assert.equal(shouldRefreshLightbox([""], current, pinned), true, "an unclassified root event refreshes conservatively");
});

test("lightbox refresh keeps the selected image when new files change its index", () => {
  const current = { path: "browser/002-current.jpg", session: "fixture" };
  const refreshed = [
    { path: "browser/001-new.jpg", session: "fixture" },
    current,
    { path: "browser/003-next.jpg", session: "fixture" },
  ];
  assert.equal(imageIndexFor(refreshed, current, 1), 1);
  assert.equal(imageIndexFor(refreshed.slice(0, 1), { path: "missing.jpg", session: "fixture" }, 4), 0);
});

test("HTTP server accepts only local Host and GET/HEAD, applies mockup CSP, and blocks traversal and symlink escape", async (t) => {
  const fixture = createJournal();
  const outsideFile = path.join(fixture.temp, "secret.txt");
  write(outsideFile, "secret");
  symlinkSync(outsideFile, path.join(fixture.session, "escape.txt"));
  const aliasRoot = path.join(fixture.temp, "journal-alias");
  symlinkSync(fixture.root, aliasRoot);
  write(path.join(fixture.session, "references.md"), `[Alias mockup](${path.join(aliasRoot, path.basename(fixture.session), "mockups/mock.html")})\n`);
  const service = await serve(fixture.root);
  t.after(async () => { await new Promise((resolve) => service.server.close(resolve)); rmSync(fixture.temp, { recursive: true, force: true }); });

  const listResponse = await fetch(`${service.base}/api/sessions`);
  assert.equal(listResponse.status, 200);
  assert.equal((await listResponse.json()).waitingCount, 1);
  const appResponse = await fetch(`${service.base}/`);
  const appPolicy = appResponse.headers.get("content-security-policy");
  assert.match(appPolicy, /script-src 'self'/);
  assert.match(appPolicy, /style-src 'self' 'unsafe-inline'/);
  assert.equal(appPolicy.includes("'unsafe-eval'"), false);
  const head = await fetch(`${service.base}/api/sessions`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");

  const badHost = await new Promise((resolve, reject) => {
    const request = httpRequest({ hostname: "127.0.0.1", port: service.port, path: "/api/sessions", headers: { Host: "evil.example" } }, (response) => resolve(response));
    request.on("error", reject);
    request.end();
  });
  assert.equal(badHost.statusCode, 403);
  const localHost = await new Promise((resolve, reject) => {
    const request = httpRequest({ hostname: "127.0.0.1", port: service.port, path: "/api/sessions", headers: { Host: `localhost:${service.port}` } }, (response) => resolve(response));
    request.on("error", reject);
    request.end();
  });
  assert.equal(localHost.statusCode, 200);
  for (const method of ["POST", "PUT", "DELETE"]) {
    const response = await fetch(`${service.base}/api/sessions`, { method });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET, HEAD");
  }
  const session = path.basename(fixture.session);
  const mockup = await fetch(`${service.base}/file?session=${encodeURIComponent(session)}&path=mockups%2Fmock.html`);
  assert.equal(mockup.status, 200);
  assert.equal(mockup.headers.get("content-security-policy"), "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:");
  const appJs = await (await fetch(`${service.base}/app.js`)).text();
  assert.match(appJs, /sandbox=\\?"allow-scripts\\?"/);
  assert.doesNotMatch(appJs, /allow-same-origin/);
  assert.match(appJs, /from\s+["']\.\/lightbox-state\.mjs["']/);
  const lightboxModule = await fetch(`${service.base}/lightbox-state.mjs`);
  assert.equal(lightboxModule.status, 200);
  assert.match(lightboxModule.headers.get("content-type"), /^text\/javascript; charset=utf-8$/);
  const lightboxSource = await lightboxModule.text();
  assert.match(lightboxSource, /export function shouldRefreshLightbox/);
  assert.ok(lightboxSource.length > 0);
  const lightboxHead = await fetch(`${service.base}/lightbox-state.mjs`, { method: "HEAD" });
  assert.equal(lightboxHead.status, 200);
  assert.equal(lightboxHead.headers.get("content-type"), lightboxModule.headers.get("content-type"));
  assert.equal(lightboxHead.headers.get("content-length"), String(Buffer.byteLength(lightboxSource)));
  assert.equal(await lightboxHead.text(), "");
  const helper = await fetch(`${service.base}/image-metadata.mjs`);
  assert.equal(helper.status, 200);
  assert.match(await helper.text(), /resolveImageViewport/);
  const markdown = await fetch(`${service.base}/api/file-text?session=${encodeURIComponent(session)}&path=references.md`);
  const markdownData = await markdown.json();
  assert.match(markdownData.html, new RegExp(`href="#/s/${session}/mockups/mockups%2Fmock\.html" data-journal-route=`));

  const traversal = await fetch(`${service.base}/file?session=${encodeURIComponent(session)}&path=..%2Fsecret.txt`);
  assert.notEqual(traversal.status, 200);
  const symlink = await fetch(`${service.base}/file?session=${encodeURIComponent(session)}&path=escape.txt`);
  assert.notEqual(symlink.status, 200);
  const methodBody = await (await fetch(`${service.base}/api/session`, { method: "POST" })).text();
  assert.match(methodBody, /Method not allowed/);
});

test("CLI reports missing and invalid roots, rejects default-port collisions without rebinding", async (t) => {
  assert.equal(DEFAULT_PORT, 4173);
  const fixture = createJournal();
  t.after(() => rmSync(fixture.temp, { recursive: true, force: true }));
  const missing = spawnSync(process.execPath, [SERVER.pathname], { encoding: "utf8", timeout: 5000 });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /--root is required/);
  const bad = spawnSync(process.execPath, [SERVER.pathname, "--root", path.join(fixture.temp, "missing")], { encoding: "utf8", timeout: 5000 });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /Invalid journal root/);
  const fileRoot = path.join(fixture.temp, "file-root");
  write(fileRoot, "not a directory");
  const nonDirectory = spawnSync(process.execPath, [SERVER.pathname, "--root", fileRoot], { encoding: "utf8", timeout: 5000 });
  assert.notEqual(nonDirectory.status, 0);
  assert.match(nonDirectory.stderr, /not a directory/);

  const occupied = createTcpServer();
  await new Promise((resolve) => occupied.listen(0, "127.0.0.1", resolve));
  const port = occupied.address().port;
  const collision = spawnSync(process.execPath, [SERVER.pathname, "--root", fixture.root, "--port", String(port)], { encoding: "utf8", timeout: 5000 });
  await new Promise((resolve) => occupied.close(resolve));
  assert.notEqual(collision.status, 0);
  assert.match(collision.stderr, new RegExp(`port ${port} is already in use`));
  assert.doesNotMatch(collision.stderr, /ReferenceError|TypeError/);
});

test("run detail stays within the session and reports output files", (t) => {
  const fixture = createJournal();
  t.after(() => rmSync(fixture.temp, { recursive: true, force: true }));
  const details = readRunDetails(fixture.root, path.basename(fixture.session), "reviews/run-failure");
  assert.equal(details.run.state.kind, "failure");
  assert.equal(details.prompt, "failure\n");
  assert.throws(() => readRunDetails(fixture.root, path.basename(fixture.session), "../outside"), /Invalid run|does not exist/);
});

test("SSE reports watcher availability and forwards a disposable journal change", async (t) => {
  const fixture = createJournal();
  const service = await serve(fixture.root);
  t.after(async () => { await new Promise((resolve) => service.server.close(resolve)); rmSync(fixture.temp, { recursive: true, force: true }); });
  const response = await fetch(`${service.base}/events`);
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const nextEvent = async (name) => {
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Timed out waiting for ${name} SSE event`)), 2000); });
    const read = async () => {
      while (true) {
        const marker = buffer.indexOf("\n\n");
        if (marker >= 0) {
          const chunk = buffer.slice(0, marker);
          buffer = buffer.slice(marker + 2);
          const eventName = chunk.match(/^event:\s*(.+)$/m)?.[1];
          const data = chunk.match(/^data:\s*(.+)$/m)?.[1];
          if (eventName === name) return data ? JSON.parse(data) : {};
          continue;
        }
        const { value, done } = await reader.read();
        if (done) throw new Error("SSE stream closed unexpectedly");
        buffer += decoder.decode(value, { stream: true });
      }
    };
    try { return await Promise.race([read(), timeout]); }
    finally { clearTimeout(timer); }
  };
  const ready = await nextEvent("ready");
  if (!ready.watcherAvailable) {
    await reader.cancel();
    assert.equal(ready.watcherAvailable, false, "unsupported fs.watch is exposed explicitly");
    return;
  }
  write(path.join(fixture.session, "new-event.txt"), "added\n");
  const change = await nextEvent("change");
  assert.match(change.path, /new-event\.txt$/);
  await reader.cancel();
});
