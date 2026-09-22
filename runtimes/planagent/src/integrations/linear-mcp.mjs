import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import { writeJson } from "../store.mjs";

export const LINEAR_ENDPOINT = "https://mcp.linear.app/mcp";
const allowed = new Set(["get_issue", "list_comments", "get_document", "list_issue_statuses", "save_comment", "delete_comment", "save_issue"]);
const authPath = () => path.join(process.env.PLANAGENT_CONFIG_DIR || path.join(homedir(), ".config", "planagent"), "linear-oauth.json");
const readAuth = () => existsSync(authPath()) ? JSON.parse(readFileSync(authPath(), "utf8")) : {};
const timedFetch = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.any([AbortSignal.timeout(30_000), ...(options.signal ? [options.signal] : [])]) });

function oauthProvider({ redirectUrl, redirect, state } = {}) {
  const initial = readAuth();
  const update = (values) => writeJson(authPath(), { ...readAuth(), ...values });
  return {
    get redirectUrl() { return redirectUrl || initial.redirectUrl; },
    get clientMetadata() { return { client_name: "Planagent", redirect_uris: [this.redirectUrl], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none", scope: "read write" }; },
    state: () => state,
    clientInformation: () => readAuth().client,
    saveClientInformation: (client) => update({ client, redirectUrl }),
    tokens: () => readAuth().tokens,
    saveTokens: (tokens) => update({ tokens }),
    saveCodeVerifier: (verifier) => update({ verifier }),
    codeVerifier: () => { const verifier = readAuth().verifier; if (!verifier) throw new Error("Missing Linear login verifier. Run plana auth linear again."); return verifier; },
    redirectToAuthorization: async (url) => {
      if (!redirect) throw new Error("Linear login required. Run plana auth linear.");
      await redirect(url);
    },
    invalidateCredentials: (scope) => {
      const value = readAuth();
      for (const key of scope === "all" ? ["client", "tokens", "verifier"] : [scope === "client" ? "client" : scope]) delete value[key];
      writeJson(authPath(), value);
    },
  };
}

export async function loginLinear() {
  if (process.env.LINEAR_API_KEY) {
    const connection = await connectLinear();
    try { return { authenticated: true, method: "LINEAR_API_KEY", tools: [...connection.tools.keys()] }; }
    finally { await connection.close(); }
  }
  const saved = readAuth();
  const nonce = randomBytes(32).toString("hex");
  let accept, reject;
  const code = new Promise((resolve, fail) => { accept = resolve; reject = fail; });
  // Handle rejection even if discovery fails before the callback is awaited.
  code.catch(() => {});
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname !== "/callback" || url.searchParams.get("state") !== nonce) { response.writeHead(400).end("Invalid login callback."); return; }
    if (url.searchParams.has("error") || !url.searchParams.get("code")) {
      response.end("Linear login was not completed. Return to Planagent."); reject(new Error("Linear authorization was declined.")); return;
    }
    response.end("Linear authorization received. You can return to Planagent.");
    accept(url.searchParams.get("code"));
  });
  const previous = saved.redirectUrl ? new URL(saved.redirectUrl) : undefined;
  if (previous && (previous.hostname !== "127.0.0.1" || previous.protocol !== "http:" || previous.pathname !== "/callback")) throw new Error("Invalid saved Linear callback URL.");
  await new Promise((resolve, fail) => { server.once("error", fail); server.listen(previous ? Number(previous.port) : 0, "127.0.0.1", resolve); });
  const redirectUrl = `http://127.0.0.1:${server.address().port}/callback`;
  const timer = setTimeout(() => reject(new Error("Linear login timed out. Run plana auth linear again.")), 300_000);
  try {
    const provider = oauthProvider({ redirectUrl, state: nonce, redirect: async (url) => {
      process.stdout.write(`Authorize Planagent in your browser:\n${url}\n`);
      const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? undefined : "xdg-open";
      if (opener) { const child = spawn(opener, [String(url)], { stdio: "ignore" }); child.on("error", () => {}); child.unref(); }
    } });
    const result = await auth(provider, { serverUrl: LINEAR_ENDPOINT, scope: "read write", fetchFn: timedFetch });
    if (result === "REDIRECT") {
      if (await auth(provider, { serverUrl: LINEAR_ENDPOINT, authorizationCode: await code, scope: "read write", fetchFn: timedFetch }) !== "AUTHORIZED") throw new Error("Linear authorization did not finish.");
    }
    const connection = await connectLinear();
    try { return { authenticated: true, method: "oauth", tools: [...connection.tools.keys()] }; }
    finally { await connection.close(); }
  } finally { clearTimeout(timer); server.close(); }
}

export function decodeResult(result) {
  if (result.isError) {
    const message = (result.content || []).filter((item) => item.type === "text").map((item) => item.text).join("\n");
    throw new Error(`Linear MCP rejected the request: ${message.slice(0, 1000)}`);
  }
  if (result.structuredContent !== undefined) return result.structuredContent;
  const text = (result.content || []).filter((item) => item.type === "text").map((item) => item.text).join("\n");
  try { return JSON.parse(text); } catch { throw new Error("Linear MCP returned an unsupported response format."); }
}

export async function connectLinear(signal) {
  if (!process.env.LINEAR_API_KEY && !readAuth().tokens) throw new Error("Linear login required. Run plana auth linear or set LINEAR_API_KEY.");
  const client = new Client({ name: "planagent", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(LINEAR_ENDPOINT), {
    ...(process.env.LINEAR_API_KEY ? { requestInit: { headers: { Authorization: `Bearer ${process.env.LINEAR_API_KEY}` } } } : { authProvider: oauthProvider() }),
    fetch: timedFetch,
    reconnectionOptions: { maxRetries: 0, initialReconnectionDelay: 1000, maxReconnectionDelay: 1000, reconnectionDelayGrowFactor: 1 },
  });
  try {
    await client.connect(transport, { signal, timeout: 30_000 });
    const tools = new Map(); let cursor;
    const cursors = new Set();
    do {
      const page = await client.listTools(cursor ? { cursor } : {}, { signal, timeout: 30_000 });
      for (const tool of page.tools) if (allowed.has(tool.name)) tools.set(tool.name, tool);
      cursor = page.nextCursor;
      if (cursor && cursors.has(cursor)) throw new Error("Linear repeated a tool-list cursor.");
      cursors.add(cursor);
    } while (cursor);
    return {
      tools,
      async call(name, args) {
        if (!allowed.has(name) || !tools.has(name)) throw new Error(`Required Linear tool is unavailable: ${name}`);
        return decodeResult(await client.callTool({ name, arguments: args }, undefined, { signal, timeout: 60_000 }));
      },
      close: () => client.close(),
    };
  } catch (error) { await client.close(); throw error; }
}
