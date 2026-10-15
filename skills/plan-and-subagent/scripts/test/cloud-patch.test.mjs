import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { exportPatch, framePatch, recoverPatch } from "../cloud-patch.mjs";

const result = (content, is_error = false) => JSON.stringify({ type: "user", remoteSourced: true, message: {
  content: [{ type: "tool_result", tool_use_id: "export", content, is_error }],
} });

test("recovers exact binary bytes from chunked, repeated CLI tool results", () => {
  const patch = Buffer.from(Array.from({ length: 10000 }, (_, i) => i % 256));
  const frames = framePatch("round-2", patch).trim().split("\n");
  const transcript = [result("[Tool call result not in this copy]"),
    ...frames.map((frame) => result([{ type: "text", text: frame }])),
    result(frames[0]), result(framePatch("round-1", Buffer.from("old patch"))),
  ].join("\n");
  assert.deepEqual(recoverPatch("round-2", transcript).patch, patch);
});

test("rejects incomplete, corrupted, conflicting, and wrong-round exports", () => {
  const frames = framePatch("round-2", Buffer.from("example patch")).trim().split("\n");
  assert.throws(() => recoverPatch("round-2", result(frames[1])), /chunks/);
  assert.throws(() => recoverPatch("round-3", result(frames.join("\n"))), /metadata/);
  assert.throws(() => recoverPatch("round-2", result(frames.join("\n"), true)), /metadata/);
  const corrupted = frames[0].replace(/(CHUNK 1 )./, "$1A");
  assert.throws(() => recoverPatch("round-2", result(corrupted + "\n" + frames[1])), /hash/);
  assert.throws(() => recoverPatch("round-2", result(frames.join("\n")) + "\n" + result(corrupted)), /Conflicting/);
  const prompt = JSON.stringify({ type: "user", message: { content: frames.join("\n") } });
  const assistant = JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: frames.join("\n") }] } });
  assert.throws(() => recoverPatch("round-2", prompt + "\n" + assistant), /metadata/);
});

test("export includes changed, new, deleted and binary files, excludes staged inputs, and applies cleanly", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cloud-patch-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, "source");
  fs.mkdirSync(source);
  const git = (args, cwd = source) => execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
  git(["init", "-b", "feature/test"]);
  fs.writeFileSync(path.join(source, "changed.txt"), "before\n");
  fs.writeFileSync(path.join(source, "deleted.txt"), "delete\n");
  fs.writeFileSync(path.join(source, "binary.bin"), Buffer.from([0, 1, 2]));
  git(["add", "."]);
  git(["-c", "user.name=seq030", "-c", "user.email=218389549+seq030@users.noreply.github.com", "-c", "commit.gpgsign=false", "commit", "-m", "Prepare test source"]);
  const base = git(["rev-parse", "HEAD"]);
  const receiver = path.join(root, "receiver");
  git(["clone", "--no-hardlinks", source, receiver], root);
  fs.mkdirSync(path.join(source, ".cloud-inputs"));
  fs.writeFileSync(path.join(source, ".cloud-inputs/brief.md"), "approved fixture");
  git(["add", "-f", ".cloud-inputs"]);
  fs.writeFileSync(path.join(source, "changed.txt"), "after\n");
  fs.writeFileSync(path.join(source, "new.txt"), "new\n");
  fs.rmSync(path.join(source, "deleted.txt"));
  fs.writeFileSync(path.join(source, "binary.bin"), Buffer.from([0, 9, 8, 7]));
  const frames = exportPatch("round-1", base, ["changed.txt", "deleted.txt", "new.txt", "binary.bin"], source);
  const { patch } = recoverPatch("round-1", result(frames));
  const patchFile = path.join(root, "result.patch");
  fs.writeFileSync(patchFile, patch);
  git(["apply", "--check", patchFile], receiver);
  git(["apply", patchFile], receiver);
  assert.equal(fs.readFileSync(path.join(receiver, "changed.txt"), "utf8"), "after\n");
  assert.equal(fs.existsSync(path.join(receiver, "deleted.txt")), false);
  assert.equal(fs.readFileSync(path.join(receiver, "new.txt"), "utf8"), "new\n");
  assert.deepEqual(fs.readFileSync(path.join(receiver, "binary.bin")), Buffer.from([0, 9, 8, 7]));
  assert.equal(fs.existsSync(path.join(receiver, ".cloud-inputs")), false);
  for (const paths of [["."], [".cloud-inputs/brief.md"], ["../escape"], [source], ["new.txt", ":(glob)*"]]) {
    // Literal pathspecs prevent glob syntax from expanding into unrelated files.
    assert.throws(() => exportPatch("round-1", base, paths, source));
  }
});
