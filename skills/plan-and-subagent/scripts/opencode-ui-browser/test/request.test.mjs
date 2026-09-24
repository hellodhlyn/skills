import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { assertAllowedPageUrl, assertPathWithin, loadRequestFile, validateRequest } from "../src/request.mjs";

const request = {
  phase: "final",
  workdir: "/tmp/project",
  artifactDir: "/tmp/project/reviews/uiux/browser",
  codeState: "abc123",
  url: "http://localhost:3000/students",
  allowedOrigins: ["http://localhost:3000"],
  viewports: [{ name: "desktop", width: 1440, height: 900 }],
  conditions: [{ id: "summary-visible", expected: "The published summary is visible." }],
  stateChangesAuthorized: false,
};

test("validates the browser boundary and declared evidence conditions", () => {
  assert.deepEqual(validateRequest(request).conditions, request.conditions);
  assert.throws(() => validateRequest({ ...request, url: "https://outside.example" }), /listed in allowedOrigins/);
  assert.throws(() => validateRequest({ ...request, conditions: [{ id: "same", expected: "one" }, { id: "same", expected: "two" }] }), /unique/);
});

test("refuses navigation and artifacts outside the declared boundary", () => {
  const boundary = { allowedOrigins: ["http://localhost:3000"] };
  assert.equal(assertAllowedPageUrl(boundary, "http://localhost:3000/students"), "http://localhost:3000/students");
  assert.throws(() => assertAllowedPageUrl(boundary, "https://outside.example"), /left allowed origins/);
  assert.throws(() => assertAllowedPageUrl(boundary, "file:///tmp/mockup/index.html"), /local file is not allowed/);
  assert.equal(assertPathWithin("/tmp/project/reviews", "/tmp/project/reviews/a.jpg"), "/tmp/project/reviews/a.jpg");
  assert.throws(() => assertPathWithin("/tmp/project/reviews", "/tmp/project/other.jpg"), /must stay within/);
});

test("a mockup request may open only local files under its declared root", () => {
  const mockup = { ...request, phase: "mockup", url: "file:///tmp/project/mockups/index.html", allowedOrigins: undefined, allowedFileRoot: "/tmp/project/mockups" };
  const validated = validateRequest(mockup);
  assert.deepEqual(validated.allowedOrigins, []);
  assert.equal(assertAllowedPageUrl(validated, "file:///tmp/project/mockups/states/empty.html"), "file:///tmp/project/mockups/states/empty.html");
  assert.throws(() => assertAllowedPageUrl(validated, "file:///tmp/project/src/secret.html"), /must stay within/);
  assert.throws(() => assertAllowedPageUrl(validated, "http://localhost:3000/"), /left allowed origins/);
  assert.throws(() => validateRequest({ ...mockup, url: "file:///etc/passwd" }), /must stay within/);
  assert.throws(() => validateRequest({ ...request, allowedOrigins: [] }), /non-empty array/);
  assert.throws(() => validateRequest({ ...request, phase: "unknown" }), /phase must be one of/);
});

test("a request file binds only artifacts inside its own directory", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "ui-browser-request-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "browser-request.json");
  writeFileSync(file, JSON.stringify({ ...request, phase: "design", artifactDir: path.join(directory, "browser") }));
  assert.equal(loadRequestFile(file).request.phase, "design");
  writeFileSync(file, JSON.stringify({ ...request, artifactDir: path.join(tmpdir(), "elsewhere") }));
  assert.throws(() => loadRequestFile(file), /artifactDir must stay within/);
  assert.throws(() => loadRequestFile("relative.json"), /absolute path/);
});
