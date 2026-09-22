import { existsSync, readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { connectLinear } from "./linear-mcp.mjs";
import { readIssue, readComments, collectionPage } from "../sources/linear.mjs";
import { digest } from "../repository.mjs";
import { acquire, runDirectory, writeJson } from "../store.mjs";

function boundIssue(run) {
  const issue = run.source?.context?.issue;
  if (run.source?.kind !== "linear" || !issue?.id) throw new Error("This run has no resolved Linear issue.");
  return issue;
}
const stateName = (issue) => typeof issue.status === "string" ? issue.status : issue.status?.name;

export async function issueStatuses(api, ref) {
  const issue = await readIssue(api, ref);
  const team = issue.teamId || (typeof issue.team === "string" ? issue.team : issue.team?.id);
  if (!team) throw new Error("Linear did not provide the issue's team; cannot resolve its statuses.");
  const page = collectionPage(await api.call("list_issue_statuses", { team }), "statuses");
  if (page.next || page.items.some((item) => !item.id || !item.name)) throw new Error("Linear returned incomplete issue statuses.");
  return { issue, statuses: page.items };
}

async function postCommentUnlocked(run, body, { connection, retry = false } = {}) {
  if (typeof body !== "string" || !body.trim()) throw new Error("Comment body must not be empty.");
  if (body.length > 100_000) throw new Error("Comment exceeds 100 KB.");
  const target = boundIssue(run);
  const filename = path.join(runDirectory(run.id), "linear-actions", `comment-${digest(body)}.json`);
  const previous = existsSync(filename) ? JSON.parse(readFileSync(filename, "utf8")) : undefined;
  if (previous?.status === "confirmed") return { ...previous, alreadyConfirmed: true };
  const api = connection || await connectLinear();
  let operation;
  try {
    const current = await readIssue(api, target.identifier);
    if (current.id !== target.id) throw new Error("Linear workspace/issue identity changed; refusing to post.");
    const comments = await readComments(api, target.id);
    if (previous) {
      const posted = comments.filter((comment) => comment.body === body && !previous.existingIds.includes(comment.id));
      if (posted.length === 1) {
        const confirmed = { ...previous, status: "confirmed", remoteId: posted[0].id, confirmedAt: new Date().toISOString() };
        writeJson(filename, confirmed); return confirmed;
      }
      if (posted.length > 1 || !retry) throw new Error("Previous comment delivery is uncertain. Inspect Linear; use --retry only after confirming that it was not posted.");
    }
    operation = { kind: "comment", status: "pending", issue: target.identifier, issueId: target.id, body, existingIds: comments.map(({ id }) => id), startedAt: new Date().toISOString() };
    writeJson(filename, operation);
    const result = await api.call("save_comment", { issueId: target.id, body });
    if (!result?.id) throw new Error("Linear did not return a comment ID.");
    const saved = (await readComments(api, target.id)).find(({ id }) => id === result.id);
    if (!saved || saved.body !== body) throw new Error("Comment delivery could not be verified.");
    operation = { ...operation, status: "confirmed", remoteId: result.id, confirmedAt: new Date().toISOString() };
    writeJson(filename, operation); return operation;
  } catch (error) {
    if (operation) { writeJson(filename, { ...operation, status: "uncertain", error: error.message }); throw new Error(`Comment delivery is uncertain; no automatic retry was made. ${error.message}`); }
    throw error;
  } finally { if (!connection) await api.close(); }
}

async function setIssueStatusUnlocked(run, requested, { connection, from } = {}) {
  if (!requested?.trim()) throw new Error("Provide the exact Linear status name or ID.");
  const target = boundIssue(run);
  const api = connection || await connectLinear();
  let operation, filename;
  try {
    const { issue, statuses } = await issueStatuses(api, target.identifier);
    if (issue.id !== target.id) throw new Error("Linear workspace/issue identity changed; refusing to update.");
    const matches = statuses.filter(({ id, name }) => id === requested || name === requested);
    if (matches.length !== 1) throw new Error(`Choose an exact status for this issue's team: ${statuses.map(({ name }) => name).join(", ")}`);
    const next = matches[0];
    if (!stateName(issue)) throw new Error("Linear did not return the current issue status.");
    if (from && stateName(issue) !== from) throw new Error(`Issue status changed: expected ${from}, found ${stateName(issue)}.`);
    if (stateName(issue) === next.name) return { status: "confirmed", unchanged: true, issue: target.identifier, state: next.name };
    filename = path.join(runDirectory(run.id), "linear-actions", `status-${randomUUID()}.json`);
    operation = { kind: "status", status: "pending", issue: target.identifier, issueId: target.id, previous: stateName(issue), state: next.name, stateId: next.id, startedAt: new Date().toISOString() };
    writeJson(filename, operation);
    await api.call("save_issue", { id: target.id, state: next.id });
    const verified = await readIssue(api, target.identifier);
    if (verified.id !== target.id || stateName(verified) !== next.name) throw new Error("Issue status update could not be verified.");
    operation = { ...operation, status: "confirmed", confirmedAt: new Date().toISOString() };
    writeJson(filename, operation); return operation;
  } catch (error) {
    if (operation) { writeJson(filename, { ...operation, status: "uncertain", error: error.message }); throw new Error(`Status delivery is uncertain; inspect the current Linear status before retrying. ${error.message}`); }
    throw error;
  } finally { if (!connection) await api.close(); }
}

async function deletePostedCommentUnlocked(run, id, { connection } = {}) {
  const target = boundIssue(run);
  const directory = path.join(runDirectory(run.id), "linear-actions");
  const entries = existsSync(directory) ? readdirSync(directory).filter((name) => name.startsWith("comment-")).map((name) => ({ filename: path.join(directory, name), data: JSON.parse(readFileSync(path.join(directory, name), "utf8")) })) : [];
  const entry = entries.find(({ data }) => data.remoteId === id && data.issueId === target.id);
  if (!entry) throw new Error("Only a comment confirmed as posted by this run can be deleted.");
  if (entry.data.status === "deleted") return { ...entry.data, alreadyConfirmed: true };
  const api = connection || await connectLinear();
  try {
    if ((await readIssue(api, target.identifier)).id !== target.id) throw new Error("Linear workspace/issue identity changed.");
    const comment = (await readComments(api, target.id)).find((item) => item.id === id);
    if (comment && comment.body !== entry.data.body) throw new Error("The posted comment was edited; refusing to delete the changed content.");
    if (comment) {
      writeJson(entry.filename, { ...entry.data, status: "delete-pending" });
      await api.call("delete_comment", { id });
      if ((await readComments(api, target.id)).some((item) => item.id === id)) throw new Error("Comment deletion could not be verified.");
    }
    const result = { ...entry.data, status: "deleted", deletedAt: new Date().toISOString() };
    writeJson(entry.filename, result); return result;
  } finally { if (!connection) await api.close(); }
}

async function lockedAction(run, action) {
  // Separate from the execution lock so explicit updates can run during work.
  const release = acquire(`linear-actions:${run.id}`, run.id);
  try { return await action(); } finally { release(); }
}
export const postComment = (run, body, options) => lockedAction(run, () => postCommentUnlocked(run, body, options));
export const setIssueStatus = (run, requested, options) => lockedAction(run, () => setIssueStatusUnlocked(run, requested, options));
export const deletePostedComment = (run, id, options) => lockedAction(run, () => deletePostedCommentUnlocked(run, id, options));
