#!/usr/bin/env node
import { createServer } from "node:http";
import { readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createJournalWatcher, readBinaryFile, readRunDetails, readSession, readTextFile, resolveInside, WEB_DIR, listSessions } from "./journal.mjs";
import { renderMarkdown } from "./markdown.mjs";

export const DEFAULT_PORT = 4173;
const MOCKUP_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:";
const DASHBOARD_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'";

function json(response, status, value, headOnly = false) {
  const body = Buffer.from(`${JSON.stringify(value)}\n`);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  response.end(headOnly ? undefined : body);
}

function plain(response, status, message, headOnly = false, extra = {}) {
  const body = Buffer.from(`${message}\n`);
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...extra,
  });
  response.end(headOnly ? undefined : body);
}

function mimeType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
  })[ext] ?? "application/octet-stream";
}

function sendFile(response, file, { headOnly = false, mockup = false } = {}) {
  const stat = statSync(file);
  if (!stat.isFile()) throw new Error("Requested path is not a file");
  response.writeHead(200, {
    "Content-Type": mimeType(file),
    "Content-Length": stat.size,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...(mockup ? { "Content-Security-Policy": MOCKUP_CSP } : { "Content-Security-Policy": DASHBOARD_CSP }),
  });
  response.end(headOnly ? undefined : readFileSync(file));
}

function resolveMarkdownTarget(root, sessionDirName, markdownPath, target) {
  const clean = target.split(/[?#]/, 1)[0];
  if (/^https?:\/\//i.test(target) || /^mailto:/i.test(target)) return { kind: "external", href: target };
  if (target.startsWith("#")) return { kind: "anchor", href: target };
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) && !/^file:\/\//i.test(target)) return { kind: "outside", path: target };
  let absolute;
  if (/^file:\/\//i.test(clean)) {
    try { absolute = new URL(clean); absolute = decodeURIComponent(absolute.pathname); } catch { return { kind: "outside", path: clean }; }
  } else if (path.isAbsolute(clean)) absolute = clean;
  else absolute = path.resolve(root, sessionDirName, path.posix.dirname(markdownPath), clean);
  const rootReal = realpathSync(root);
  let canonical;
  try { canonical = realpathSync(absolute); } catch { return { kind: "outside", path: clean }; }
  const resolved = resolveInside(rootReal, path.relative(rootReal, canonical));
  if (!resolved) return { kind: "outside", path: clean };
  const relativeToRoot = path.relative(rootReal, resolved).split(path.sep).join("/");
  const [targetSession, ...rest] = relativeToRoot.split("/");
  if (!targetSession || !rest.length) return { kind: "outside", path: clean };
  const rel = rest.join("/");
  const ext = path.extname(rel).toLowerCase();
  if ([".jpg", ".jpeg", ".png"].includes(ext)) return { kind: "image", session: targetSession, path: rel, src: `/file?session=${encodeURIComponent(targetSession)}&path=${encodeURIComponent(rel)}` };
  const tab = [".html", ".htm"].includes(ext) ? "mockups" : ext === ".md" ? "documents" : "documents";
  return { kind: "route", route: `#/s/${encodeURIComponent(targetSession)}/${tab}/${encodeURIComponent(rel)}` };
}

function parseRequestUrl(request) {
  try { return new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`); }
  catch { return null; }
}

export function createDashboardServer(root, { port = DEFAULT_PORT, host = "127.0.0.1", logger = console } = {}) {
  const rootReal = realpathSync(root);
  if (!statSync(rootReal).isDirectory()) throw new Error(`Journal root is not a directory: ${root}`);
  let watcherAvailable = true;
  const clients = new Set();
  let pendingPaths = new Set();
  let debounceTimer = null;

  const broadcast = (relativePath) => {
    pendingPaths.add(relativePath);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const paths = [...pendingPaths];
      const payload = JSON.stringify({ path: paths.at(-1) ?? "", paths });
      for (const client of clients) client.write(`event: change\ndata: ${payload}\n\n`);
      pendingPaths = new Set();
    }, 80);
  };
  const markWatcherUnavailable = (error) => {
    if (!watcherAvailable) return;
    watcherAvailable = false;
    logger.error?.(`Real-time watch unavailable: ${error?.message ?? error}`);
    for (const client of clients) client.write(`event: watch-unavailable\ndata: ${JSON.stringify({ message: "fs.watch를 사용할 수 없습니다" })}\n\n`);
  };
  const watcher = createJournalWatcher(rootReal, broadcast, markWatcherUnavailable);
  if (!watcher) watcherAvailable = false;

  const server = createServer((request, response) => {
    const headOnly = request.method === "HEAD";
    if (request.method !== "GET" && !headOnly) {
      plain(response, 405, "Method not allowed", headOnly, { Allow: "GET, HEAD" });
      return;
    }
    const effectivePort = server.address()?.port ?? port;
    const allowedHosts = new Set([`127.0.0.1:${effectivePort}`, `localhost:${effectivePort}`]);
    if (!allowedHosts.has(request.headers.host ?? "")) {
      plain(response, 403, "Invalid Host header", headOnly);
      return;
    }
    const url = parseRequestUrl(request);
    if (!url) { plain(response, 400, "Invalid request URL", headOnly); return; }

    try {
      if (url.pathname === "/" || url.pathname === "/index.html") {
        const file = resolveInside(WEB_DIR, "index.html");
        if (!file) throw new Error("Dashboard entry file is unavailable");
        sendFile(response, file, { headOnly });
        return;
      }
      if (url.pathname === "/app.css" || url.pathname === "/app.js" || url.pathname === "/image-metadata.mjs" || url.pathname === "/lightbox-state.mjs") {
        const file = resolveInside(WEB_DIR, url.pathname.slice(1));
        if (!file) throw new Error("Dashboard asset is unavailable");
        sendFile(response, file, { headOnly });
        return;
      }
      if (url.pathname === "/api/sessions") {
        json(response, 200, listSessions(rootReal), headOnly);
        return;
      }
      if (url.pathname === "/api/session") {
        const dir = url.searchParams.get("dir") ?? "";
        json(response, 200, readSession(rootReal, dir), headOnly);
        return;
      }
      if (url.pathname === "/api/file-text") {
        const session = url.searchParams.get("session") ?? "";
        const file = url.searchParams.get("path") ?? "";
        const result = readTextFile(rootReal, session, file);
        const ext = path.extname(file).toLowerCase();
        if (ext === ".md") {
          const rendered = renderMarkdown(result.text, (target) => resolveMarkdownTarget(rootReal, session, file, target));
          json(response, 200, { ...result, ...rendered }, headOnly);
        } else json(response, 200, result, headOnly);
        return;
      }
      if (url.pathname === "/api/run") {
        const session = url.searchParams.get("session") ?? "";
        const runDir = url.searchParams.get("path") ?? "";
        const details = readRunDetails(rootReal, session, runDir);
        const rendered = details.result ? renderMarkdown(details.result, (target) => resolveMarkdownTarget(rootReal, session, `${runDir}/result.md`, target)) : null;
        json(response, 200, { ...details, resultHtml: rendered?.html ?? null }, headOnly);
        return;
      }
      if (url.pathname === "/file") {
        const session = url.searchParams.get("session") ?? "";
        const relative = url.searchParams.get("path") ?? "";
        const result = readBinaryFile(rootReal, session, relative);
        sendFile(response, result.path, { headOnly, mockup: /\.html?$/i.test(relative) });
        return;
      }
      if (url.pathname === "/events") {
        response.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        if (headOnly) { response.end(); return; }
        response.write(`event: ready\ndata: ${JSON.stringify({ watcherAvailable })}\n\n`);
        clients.add(response);
        request.on("close", () => clients.delete(response));
        return;
      }
      plain(response, 404, "Not found", headOnly);
    } catch (error) {
      const status = /Invalid session path|Invalid request URL/.test(error.message) ? 400 : /does not exist|not a file|outside the session|not a directory/.test(error.message) ? 404 : 400;
      if (url.pathname.startsWith("/api/")) json(response, status, { error: error.message }, headOnly);
      else plain(response, status, error.message, headOnly);
    }
  });

  server.on("close", () => {
    clearTimeout(debounceTimer);
    watcher?.close();
    for (const client of clients) client.end();
  });
  return { server, watcher, root: rootReal, host, port };
}

function parseArgs(args) {
  const parsed = { port: DEFAULT_PORT };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--root" || arg === "--port") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      parsed[arg.slice(2)] = value;
      index += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!parsed.root) throw new Error("--root is required");
  const port = Number(parsed.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("--port must be an integer from 1 to 65535");
  parsed.port = port;
  try {
    const root = realpathSync(parsed.root);
    if (!statSync(root).isDirectory()) throw new Error("not a directory");
    parsed.root = root;
  } catch (error) {
    throw new Error(`Invalid journal root: ${parsed.root} (${error.code === "ENOENT" ? "not found" : error.message})`);
  }
  return parsed;
}

export function startFromArgs(args, logger = console) {
  let config;
  try { config = parseArgs(args); }
  catch (error) { logger.error(`ERROR: ${error.message}`); process.exitCode = 1; return null; }
  const { server, watcher, root, port } = createDashboardServer(config.root, { port: config.port, logger });
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") logger.error(`ERROR: port ${port} is already in use.`);
    else logger.error(`ERROR: dashboard server failed: ${error.message}`);
    watcher?.close();
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => {
    logger.log(`Session dashboard: http://127.0.0.1:${port}/`);
    logger.log(`Journal root: ${root}`);
  });
  const stop = () => server.close();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) startFromArgs(process.argv.slice(2));
