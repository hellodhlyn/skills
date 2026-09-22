import { connectLinear } from "../integrations/linear-mcp.mjs";
import { digest } from "../repository.mjs";

const identifier = /^[A-Z][A-Z0-9]*-\d+$/;
export function linearReference(value) {
  if (typeof value !== "string") throw new Error("Provide a Linear issue identifier or URL.");
  if (identifier.test(value.toUpperCase())) return value.toUpperCase();
  try {
    const url = new URL(value);
    const ref = url.pathname.match(/\/issue\/([^/]+)/)?.[1];
    if (url.protocol === "https:" && url.hostname === "linear.app" && ref && identifier.test(ref.toUpperCase())) return ref.toUpperCase();
  } catch {}
  throw new Error("Use a canonical Linear identifier (for example ENG-123) or a linear.app issue URL.");
}

export function collectionPage(value, key) {
  if (Array.isArray(value)) return { items: value, next: undefined, array: true };
  const items = value?.[key] ?? value?.nodes ?? value?.items;
  if (!Array.isArray(items)) throw new Error(`Linear returned an unsupported ${key} response.`);
  const hasNext = value.pageInfo?.hasNextPage ?? value.hasNextPage;
  const next = hasNext === false ? undefined : value.nextCursor ?? (hasNext ? value.pageInfo?.endCursor ?? value.cursor : undefined);
  if (hasNext && !next) throw new Error(`Linear omitted the next ${key} cursor; refusing partial context.`);
  return { items, next };
}

export async function readIssue(api, ref) {
  const canonical = linearReference(ref);
  const raw = await api.call("get_issue", { id: canonical, includeRelations: true });
  // Current Linear MCP exposes the human identifier as id and the stable ID as uuid.
  const issue = { ...raw, id: raw?.uuid ?? (raw?.identifier ? raw.id : undefined), identifier: raw?.identifier ?? raw?.id };
  if (typeof issue.id !== "string" || !issue.id || typeof issue.title !== "string" || !issue.title.trim() || issue.identifier !== canonical || !issue.url || linearReference(issue.url) !== canonical) throw new Error("Linear did not return the requested issue's canonical identity and title.");
  if (issue.description != null && typeof issue.description !== "string") throw new Error("Linear returned an unsupported issue description.");
  return issue;
}

export async function readComments(api, issueId) {
  const properties = api.tools.get("list_comments")?.inputSchema?.properties || {};
  const results = [], seen = new Set(); let cursor;
  do {
    const response = await api.call("list_comments", { issueId, ...(properties.limit ? { limit: 250 } : {}), ...(cursor ? { cursor } : {}) });
    const page = collectionPage(response, "comments");
    if (page.array && properties.limit && page.items.length >= 250) throw new Error("Linear omitted comment pagination metadata; refusing potentially partial context.");
    for (const item of page.items) {
      if (!item.id || typeof item.body !== "string") throw new Error("Linear returned an incomplete comment.");
      if (!results.some(({ id }) => id === item.id)) results.push(item);
    }
    cursor = page.next;
    if (cursor && (!properties.cursor || seen.has(cursor))) throw new Error("Linear comment pagination cannot continue safely.");
    seen.add(cursor);
    if (results.length > 2000) throw new Error("This issue exceeds the 2000-comment context limit; narrow the source before planning.");
  } while (cursor);
  return results;
}

function documentReference(value) {
  try {
    const url = new URL(value);
    const slug = url.pathname.match(/\/document\/([^/]+)/)?.[1];
    if (url.protocol !== "https:" || url.hostname !== "linear.app" || !slug) throw new Error();
    return decodeURIComponent(slug);
  } catch {
    if (/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(value)) return value;
    throw new Error("Use a Linear document ID, slug, or linear.app document URL.");
  }
}

export async function readLinearContext(ref, documentRefs = [], { connection, signal } = {}) {
  const api = connection || await connectLinear(signal);
  try {
    const issue = await readIssue(api, ref);
    const rawComments = await readComments(api, issue.id);
    const text = [issue.description || "", ...rawComments.map(({ body }) => body)].join("\n");
    const linked = [...text.matchAll(/https:\/\/linear\.app\/[^\s<>"\)\]]+\/document\/[^\s<>"\)\]]+/g)].map(([url]) => url);
    const attached = (issue.documents || []).map((document) => typeof document === "string" ? document : document.id || document.url);
    if (attached.some((value) => typeof value !== "string")) throw new Error("Linear returned a document reference without an ID or URL.");
    const refs = [...new Set([...documentRefs, ...attached, ...linked].map(documentReference))];
    if (refs.length > 30) throw new Error("This issue links more than 30 documents; narrow the source before planning.");
    const documents = [];
    for (const id of refs) {
      const document = await api.call("get_document", { id });
      if (!document?.id || !document.title || typeof document.content !== "string") throw new Error(`Linear document content is unavailable: ${id}`);
      documents.push({ id: document.id, title: document.title, url: document.url, updatedAt: document.updatedAt, content: document.content });
    }
    const context = {
      issue: { id: issue.id, identifier: issue.identifier, url: issue.url, title: issue.title, description: issue.description ?? "", status: issue.status, team: issue.team, teamId: issue.teamId, updatedAt: issue.updatedAt, relations: issue.relations, attachments: issue.attachments },
      comments: rawComments.map(({ id, body, createdAt, updatedAt, author, user, quotedText }) => ({ id, body, createdAt, updatedAt, author: author?.name ?? user?.name, quotedText })),
      documents,
      limitations: ["Related issues and external links are references only; their contents and binary attachments have not been fetched."],
    };
    // Hash precisely the JSON that is persisted and sent to the planner.
    const serializable = JSON.parse(JSON.stringify(context));
    if (JSON.stringify(serializable).length > 300_000) throw new Error("Linear context exceeds 300 KB; narrow the source before planning.");
    return { kind: "linear", ref: issue.identifier, fetchedAt: new Date().toISOString(), documentRefs, hash: digest(serializable), context: serializable };
  } finally { if (!connection) await api.close(); }
}
