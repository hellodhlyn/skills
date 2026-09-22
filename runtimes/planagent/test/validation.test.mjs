import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { validate } from "../src/validation.mjs";

test("real validation processes preserve failure and successful output", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "planagent-validation-"));
  try {
    const result = await validate(directory, [
      { id: "success", argv: [process.execPath, "-e", "console.log('checked')"] },
      { id: "failure", argv: [process.execPath, "-e", "console.error('failed'); process.exit(7)"] },
      { id: "missing", argv: [path.join(directory, "missing-executable")] },
    ], directory, 5000, new AbortController().signal);
    assert.deepEqual(result.slice(0, 2).map(({ status, exitCode }) => [status, exitCode]), [["PASS", 0], ["FAIL", 7]]);
    assert.equal(result[2].status, "FAIL"); assert.match(result[2].reason, /ENOENT/);
    assert.match(readFileSync(result[0].stdoutPath, "utf8"), /checked/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("a timed-out actual process cannot count as a passed check", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "planagent-timeout-"));
  try {
    const [result] = await validate(directory, [{ id: "timeout", argv: [process.execPath, "-e", "setTimeout(() => {}, 10000)"] }], directory, 100, new AbortController().signal);
    assert.equal(result.status, "FAIL"); assert.equal(result.reason, "timeout");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
