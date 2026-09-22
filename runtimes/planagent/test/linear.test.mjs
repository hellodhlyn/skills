import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { linearReference, readLinearContext, readComments } from "../src/sources/linear.mjs";
import { decodeResult } from "../src/integrations/linear-mcp.mjs";
import { postComment, setIssueStatus, deletePostedComment } from "../src/integrations/linear-actions.mjs";
import { planHash } from "../src/workflow.mjs";
import { digest } from "../src/repository.mjs";

function fixture() {
  const issue = { id: "ENG-123", uuid: "issue-uuid", title: "Fix a parser", description: "Reject empty input.", url: "https://linear.app/example/issue/ENG-123/fix-parser", status: "Todo", team: "Engineering", teamId: "team-uuid", documents: [] };
  const comments = [], calls = [];
  const api = {
    tools: new Map([["list_comments", { inputSchema: { properties: { limit: {}, cursor: {} } } }]]),
    async call(name, args) {
      calls.push({ name, args });
      if (name === "get_issue") return { ...issue };
      if (name === "list_comments") return { comments: [...comments], hasNextPage: false };
      if (name === "save_comment") { const comment = { id: `comment-${comments.length + 1}`, body: args.body }; comments.push(comment); return comment; }
      if (name === "delete_comment") { comments.splice(comments.findIndex(({ id }) => id === args.id), 1); return { success: true }; }
      if (name === "list_issue_statuses") return [{ id: "todo", name: "Todo" }, { id: "doing", name: "In Progress" }];
      if (name === "save_issue") { assert.deepEqual(Object.keys(args).sort(), ["id", "state"]); issue.status = "In Progress"; return { ...issue }; }
      if (name === "get_document") return { id: args.id, title: "Parser contract", content: "Empty strings are invalid." };
      throw new Error(`Unexpected tool: ${name}`);
    },
  };
  const run = { id: "linear-test-run", plan: { summary: "Fix parser" }, source: { kind: "linear", ref: "ENG-123", context: { issue: { ...issue, id: issue.uuid, identifier: issue.id } } } };
  return { api, issue, comments, calls, run };
}

async function withState(action) {
  const directory = mkdtempSync("/private/tmp/planagent-linear-test-");
  const previous = process.env.PLANAGENT_STATE_DIR;
  process.env.PLANAGENT_STATE_DIR = directory;
  try { await action(); }
  finally { if (previous === undefined) delete process.env.PLANAGENT_STATE_DIR; else process.env.PLANAGENT_STATE_DIR = previous; rmSync(directory, { recursive: true, force: true }); }
}

test("Linear references cannot turn unrelated URLs or bare numbers into issues", () => {
  assert.equal(linearReference("eng-123"), "ENG-123");
  assert.equal(linearReference("https://linear.app/example/issue/ENG-123/title"), "ENG-123");
  for (const value of ["123", "https://github.com/example/issue/ENG-123", "https://linear.app.evil.test/issue/ENG-123", "P-ENG-123"]) assert.throws(() => linearReference(value));
});

test("source collection preserves canonical identity, comments, documents, and a stable content hash", async () => {
  const { api, issue, comments, calls } = fixture();
  issue.documents = [{ id: "linked-doc" }];
  comments.push({ id: "comment-1", body: "Also handle whitespace." });
  const source = await readLinearContext("ENG-123", [], { connection: api });
  assert.equal(source.context.issue.id, "issue-uuid");
  assert.equal(source.context.issue.identifier, "ENG-123");
  assert.equal(source.context.documents[0].content, "Empty strings are invalid.");
  assert.equal(source.hash, digest(source.context));
  assert.equal(calls.some(({ name }) => /save|delete/.test(name)), false);
  const run = { plan: {}, source };
  const approvedHash = planHash(run);
  run.source = { ...source, hash: "changed-source" };
  assert.notEqual(planHash(run), approvedHash);
  issue.id = "ENG-999";
  await assert.rejects(readLinearContext("ENG-123", [], { connection: api }), /canonical/);
});

test("comment pagination is complete and fails closed when a cursor is missing or repeated", async () => {
  const { api } = fixture();
  api.call = async (_name, args) => args.cursor ? { comments: [{ id: "2", body: "second" }], hasNextPage: false } : { comments: [{ id: "1", body: "first" }], hasNextPage: true, nextCursor: "next" };
  assert.deepEqual((await readComments(api, "issue-uuid")).map(({ id }) => id), ["1", "2"]);
  api.call = async () => ({ comments: [], hasNextPage: true });
  await assert.rejects(readComments(api, "issue-uuid"), /omitted/);
  api.call = async () => ({ comments: [], nextCursor: "repeat" });
  await assert.rejects(readComments(api, "issue-uuid"), /cannot continue/);
});

test("explicit comments preserve body, verify delivery and do not duplicate on repeat", async () => withState(async () => {
  const { api, run, comments, calls } = fixture();
  const body = "Line one\n\nLiteral $() and `code`.\n";
  const first = await postComment(run, body, { connection: api });
  assert.equal(first.status, "confirmed");
  assert.equal(comments[0].body, body);
  assert.equal((await postComment(run, body, { connection: api })).alreadyConfirmed, true);
  assert.equal(calls.filter(({ name }) => name === "save_comment").length, 1);
  assert.deepEqual(calls.find(({ name }) => name === "save_comment").args, { issueId: "issue-uuid", body });
}));

test("a lost write acknowledgment is reconciled by reading, never blindly replayed", async () => withState(async () => {
  const { api, run, calls } = fixture();
  const call = api.call;
  api.call = async (name, args) => { const result = await call(name, args); if (name === "save_comment") throw new Error("Connection lost after write"); return result; };
  await assert.rejects(postComment(run, "Test", { connection: api }), /uncertain/);
  const resolved = await postComment(run, "Test", { connection: api });
  assert.equal(resolved.status, "confirmed");
  assert.equal(calls.filter(({ name }) => name === "save_comment").length, 1);
}));

test("status updates resolve the issue's team, enforce --from, and only patch state", async () => withState(async () => {
  const { api, run, calls } = fixture();
  await assert.rejects(setIssueStatus(run, "Unknown", { connection: api }), /exact status/);
  await assert.rejects(setIssueStatus(run, "In Progress", { connection: api, from: "Done" }), /expected Done/);
  assert.equal(calls.some(({ name }) => name === "save_issue"), false);
  const result = await setIssueStatus(run, "In Progress", { connection: api, from: "Todo" });
  assert.equal(result.status, "confirmed");
  assert.deepEqual(calls.find(({ name }) => name === "save_issue").args, { id: "issue-uuid", state: "doing" });
  assert.equal((await setIssueStatus(run, "In Progress", { connection: api })).unchanged, true);
  assert.equal(calls.filter(({ name }) => name === "save_issue").length, 1);
}));

test("cleanup only deletes this run's own unchanged comment", async () => withState(async () => {
  const { api, run, comments } = fixture();
  await assert.rejects(deletePostedComment(run, "unrelated", { connection: api }), /Only a comment/);
  const posted = await postComment(run, "Test", { connection: api });
  comments[0].body = "Edited by a user";
  await assert.rejects(deletePostedComment(run, posted.remoteId, { connection: api }), /edited/);
  comments[0].body = "Test";
  assert.equal((await deletePostedComment(run, posted.remoteId, { connection: api })).status, "deleted");
  assert.equal(comments.length, 0);
}));

test("MCP tool errors and unsupported response formats remain visible", () => {
  assert.deepEqual(decodeResult({ content: [{ type: "text", text: '{"id":"ok"}' }] }), { id: "ok" });
  assert.throws(() => decodeResult({ isError: true, content: [{ type: "text", text: "Denied" }] }), /Denied/);
  assert.throws(() => decodeResult({ content: [{ type: "text", text: "not JSON" }] }), /unsupported/);
});
