import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import {
  assertAllowedPageUrl,
  assertPathWithin,
  validateReport,
  validateRequest,
} from "../src/request.mjs";

function validRequest(overrides = {}) {
  return {
    phase: "final",
    workdir: process.cwd(),
    artifactDir: process.cwd(),
    codeState: "working-tree:abc",
    url: "http://127.0.0.1:3000/example",
    allowedOrigins: ["http://127.0.0.1:3000"],
    viewports: [{ name: "desktop", width: 1280, height: 800 }],
    conditions: [{ id: "UI-1", expected: "No overflow", scenarios: ["Open the page"] }],
    stateChangesAuthorized: false,
    ...overrides,
  };
}

test("validates a complete final request", () => {
  const request = validateRequest(validRequest());
  assert.equal(request.phase, "final");
  assert.equal(request.allowedOrigins[0], "http://127.0.0.1:3000");
});

test("rejects navigation outside allowed origins", () => {
  assert.throws(
    () => assertAllowedPageUrl(["http://127.0.0.1:3000"], "https://example.com"),
    /left allowed origins/,
  );
});

test("rejects artifacts outside their assigned directory", () => {
  assert.throws(() => assertPathWithin("/tmp/assigned", "/tmp/other/report.json"), /must stay within/);
});

test("requires accepted findings only for rechecks", () => {
  assert.throws(
    () => validateRequest(validRequest({ phase: "recheck", acceptedFindings: [] })),
    /requires acceptedFindings/,
  );
  assert.throws(
    () => validateRequest(validRequest({ acceptedFindings: ["F-1"] })),
    /only valid for recheck/,
  );
});

test("requires a status for every assigned condition", () => {
  const request = validateRequest(validRequest());
  const evidence = path.join(process.cwd(), "package.json");
  assert.throws(
    () => validateReport({ summary: "Incomplete", conditions: [] }, request),
    /missing condition/,
  );
  assert.doesNotThrow(() => validateReport({
    summary: "Complete",
    conditions: [{
      id: "UI-1",
      status: "PASS",
      observation: "Fits",
      evidence: [evidence],
      reproductionSteps: [],
    }],
    findings: [],
    limitations: [],
  }, request));
});

test("rejects findings that are not tied to an assigned condition", () => {
  const request = validateRequest(validRequest());
  const evidence = path.join(process.cwd(), "package.json");
  assert.throws(() => validateReport({
    summary: "Complete",
    conditions: [{
      id: "UI-1",
      status: "FAIL",
      observation: "Overflow",
      evidence: [evidence],
      reproductionSteps: ["Open the page"],
    }],
    findings: [{
      id: "F-1",
      title: "Overflow",
      conditionId: "UI-2",
      trigger: "Open the page",
      impact: "Primary action is clipped",
      evidence: [evidence],
      correctionDirection: "Keep the action within the viewport",
    }],
    limitations: [],
  }, request), /unknown condition/);
});

test("limits a recheck report to accepted finding IDs", () => {
  const request = validateRequest(validRequest({
    phase: "recheck",
    acceptedFindings: ["F-1"],
  }));
  const evidence = path.join(process.cwd(), "package.json");
  assert.throws(() => validateReport({
    summary: "Recheck complete",
    conditions: [{
      id: "UI-1",
      status: "FAIL",
      observation: "Overflow remains",
      evidence: [evidence],
      reproductionSteps: ["Open the page"],
    }],
    findings: [{
      id: "F-2",
      title: "Overflow",
      conditionId: "UI-1",
      trigger: "Open the page",
      impact: "Primary action is clipped",
      evidence: [evidence],
      correctionDirection: "Keep the action within the viewport",
    }],
    limitations: [],
  }, request), /unaccepted finding/);
});
