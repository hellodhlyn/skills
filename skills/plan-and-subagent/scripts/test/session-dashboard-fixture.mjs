#!/usr/bin/env node
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==", "base64");

function write(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, value);
}

export function createFixtureJournal(root = mkdtempSync(path.join(os.tmpdir(), "session-dashboard-preview-"))) {
  const session = path.join(root, "2026-09-26-dashboard-preview");
  const activeRun = "reviews/implementer/run-active";
  const browser = path.join(session, activeRun, "browser");
  const staleRun = "reviews/implementer/run-stale";
  const now = new Date().toISOString();
  const old = new Date(Date.now() - 10 * 60_000).toISOString();
  write(path.join(session, "session.md"), "# Session: Dashboard preview\n\n## Current checkpoint\n\n- Reviewing the new session dashboard.\n- The example includes current work and a mockup.\n");
  write(path.join(session, "approved_brief.md"), `[Linked screenshot](${activeRun}/browser/001-I5-1-desktop.jpg)\n\n![Another screenshot](${path.join(browser, "002-I5-desktop.jpg")})\n`);
  write(path.join(session, "final_summary.md"), "# Final summary\n\nPreview fixture only.\n");
  write(path.join(session, "status.json"), `${JSON.stringify({
    schema: 1,
    updatedAt: now,
    stage: 5,
    waitingOn: "user",
    summary: "The dashboard implementation is ready for result confirmation.",
    nextAction: "Review the current design and choose a direction.",
    userDecision: { question: "Which preview should be reviewed?", options: ["Desktop", "Mobile"] },
    activeRuns: [
      { runDir: activeRun, agent: "codex", role: "implementer", startedAt: old },
      { runDir: staleRun, agent: "claude", role: "reviewer", startedAt: old },
    ],
    focus: [
      { path: "mockups/session-dashboard.html", note: "HTML preview" },
      { path: `${activeRun}/browser`, note: "Captured evidence" },
    ],
  }, null, 2)}\n`);
  write(path.join(session, "mockups/session-dashboard.html"), "<!doctype html><html><head><meta charset=\"utf-8\"><style>body{font:16px system-ui;padding:2rem}</style></head><body><h1>Dashboard mockup</h1><button onclick=\"document.body.dataset.clicked='yes'\">Inline script sample</button></body></html>\n");
  write(path.join(session, activeRun, "browser-request.json"), JSON.stringify({
    artifactDir: browser,
    url: pathToFileURL(path.join(session, "mockups/session-dashboard.html")).href,
    conditions: [
      { id: "I5", expected: "The base image is visible." },
      { id: "I5-1", expected: "The hyphenated condition is grouped correctly." },
    ],
    viewports: [{ name: "mobile", width: 390, height: 844 }, { name: "desktop", width: 1280, height: 900 }],
  }, null, 2));
  write(path.join(browser, "001-I5-1-desktop.jpg"), PNG);
  write(path.join(browser, "002-I5-desktop.jpg"), PNG);
  for (let index = 3; index <= 8; index += 1) write(path.join(browser, `${String(index).padStart(3, "0")}-I5-1-desktop.jpg`), PNG);
  write(path.join(browser, "001-I5-1-desktop-audit.json"), JSON.stringify({
    overflow: { horizontal: false }, console: [], pageErrors: [], axe: [{ id: "color-contrast", impact: "serious" }],
  }, null, 2));
  write(path.join(session, activeRun, "prompt.md"), "Implement the preview fixture.\n");
  write(path.join(session, activeRun, "events.jsonl"), `${JSON.stringify({ type: "thread.started", timestamp: old, thread_id: "thread-fixture" })}\n`);
  write(path.join(session, activeRun, "thread-id"), "thread-fixture\n");
  write(path.join(session, activeRun, "models"), "gpt-6-luna\n");
  write(path.join(session, activeRun, "result.md"), "# In progress\n\nWaiting for user confirmation.\n");
  write(path.join(session, staleRun, "prompt.md"), "A run that ended before status.json was updated.\n");
  write(path.join(session, staleRun, "output.json"), "{}\n");
  write(path.join(session, staleRun, "exit-code"), "3\n");
  write(path.join(session, "reviews/implementer/run-success/prompt.md"), "A successful run.\n");
  write(path.join(session, "reviews/implementer/run-success/output.json"), "{}\n");
  write(path.join(session, "reviews/implementer/run-success/exit-code"), "0\n");
  write(path.join(session, "reviews/implementer/run-failed/prompt.md"), "A failed run.\n");
  write(path.join(session, "reviews/implementer/run-failed/events.jsonl"), "{}\n");
  write(path.join(session, "reviews/implementer/run-failed/exit-code"), "3\n");
  write(path.join(session, "reviews/implementer/run-no-exit/prompt.md"), "A run without exit-code.\n");
  write(path.join(session, "reviews/implementer/run-no-exit/result.md"), "Work stopped before an exit code was recorded.\n");
  write(path.join(session, "approved/009-unlinked.png"), PNG);
  const legacy = path.join(root, "2026-09-20-legacy-example");
  write(path.join(legacy, "session.md"), "# Legacy session\n\n## Last checkpoint\n\n- This session has no status file.\n");
  write(path.join(legacy, "final_summary.md"), "# Final summary\n\nCompleted work is described here, but it does not imply approval.\n");
  const corrupt = path.join(root, "2026-09-19-corrupt-example");
  write(path.join(corrupt, "session.md"), "# Corrupt status example\n\n## Current checkpoint\n\n- Use the legacy status view.\n");
  write(path.join(corrupt, "status.json"), "{\"schema\":\n");
  return root;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { process.stdout.write(`${createFixtureJournal()}\n`); }
  catch (error) { process.stderr.write(`Unable to create dashboard fixture: ${error.message}\n`); process.exitCode = 1; }
}
