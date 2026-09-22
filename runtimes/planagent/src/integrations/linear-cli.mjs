import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { connectLinear } from "./linear-mcp.mjs";
import { readLinearContext } from "../sources/linear.mjs";
import { issueStatuses, postComment, setIssueStatus, deletePostedComment } from "./linear-actions.mjs";
import { load } from "../store.mjs";

const help = `Explicit Linear commands (no automatic comments or status transitions):
  plana linear show ISSUE_ID_OR_URL [--document ID_OR_URL] [--json]
  plana linear statuses ISSUE_ID_OR_URL
  plana linear comment RUN_ID --body-file FILE [--retry]
  plana linear set-status RUN_ID "EXACT_STATUS" [--from "CURRENT_STATUS"]
  plana linear delete-comment RUN_ID COMMENT_ID

Writes target only the resolved issue attached to the run. Read the comment file
before posting. --retry authorizes another attempt after an uncertain delivery.
delete-comment only removes a comment previously posted by this run.
`;

export async function runLinearCli(args) {
  if (!args.length || (args.length === 1 && ["--help", "-h"].includes(args[0]))) { process.stdout.write(help); return 0; }
  let parsed;
  try { parsed = parseArgs({ args, allowPositionals: true, options: { "body-file": { type: "string" }, from: { type: "string" }, retry: { type: "boolean" }, json: { type: "boolean" }, document: { type: "string", multiple: true } } }); }
  catch (error) { process.stderr.write(`${error.message}\n`); return 2; }
  const { positionals, values } = parsed;
  const [command, ref, value] = positionals;
  const allowed = { show: ["json", "document"], statuses: [], comment: ["body-file", "retry"], "set-status": ["from"], "delete-comment": [] };
  const count = ["set-status", "delete-comment"].includes(command) ? 3 : 2;
  if (!allowed[command] || positionals.length !== count || Object.keys(values).some((key) => !allowed[command].includes(key)) || (command === "comment" && !values["body-file"])) {
    process.stderr.write(help); return 2;
  }
  if (command === "show") {
    const source = await readLinearContext(ref, values.document);
    if (values.json) process.stdout.write(`${JSON.stringify(source, null, 2)}\n`);
    else process.stdout.write(`${source.ref}: ${source.context.issue.title}\n${source.context.issue.url}\n\n${source.context.issue.description}\n\nComments: ${source.context.comments.length}; documents: ${source.context.documents.length}\nSource hash: ${source.hash}\n`);
    return 0;
  }
  if (command === "statuses") {
    const api = await connectLinear();
    try { const { issue, statuses } = await issueStatuses(api, ref); process.stdout.write(`${issue.identifier}: ${issue.title}\n${statuses.map(({ name }) => `- ${name}`).join("\n")}\n`); }
    finally { await api.close(); }
    return 0;
  }
  const run = load(ref);
  const result = command === "comment" ? await postComment(run, readFileSync(values["body-file"], "utf8"), { retry: values.retry })
    : command === "delete-comment" ? await deletePostedComment(run, value)
    : await setIssueStatus(run, value, { from: values.from });
  process.stdout.write(`${JSON.stringify({ status: result.status, issue: result.issue, commentId: result.remoteId, state: result.state, unchanged: result.unchanged, alreadyConfirmed: result.alreadyConfirmed }, null, 2)}\n`);
  return 0;
}
