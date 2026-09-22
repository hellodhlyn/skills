import assert from "node:assert/strict";
import test from "node:test";

import { assertAllowedPageUrl, assertPathWithin, validateRequest } from "../src/request.mjs";

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
  assert.equal(assertAllowedPageUrl(["http://localhost:3000"], "http://localhost:3000/students"), "http://localhost:3000/students");
  assert.throws(() => assertAllowedPageUrl(["http://localhost:3000"], "https://outside.example"), /left allowed origins/);
  assert.equal(assertPathWithin("/tmp/project/reviews", "/tmp/project/reviews/a.jpg"), "/tmp/project/reviews/a.jpg");
  assert.throws(() => assertPathWithin("/tmp/project/reviews", "/tmp/project/other.jpg"), /must stay within/);
});
