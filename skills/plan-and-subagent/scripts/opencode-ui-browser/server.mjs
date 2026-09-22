import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { chromium } from "playwright";
import { z } from "zod";

import { assertAllowedPageUrl, assertPathWithin, validateRequest } from "./src/request.mjs";

function configuredRequest() {
  const requestPath = process.env.PLAN_AND_SUBAGENT_UI_BROWSER_REQUEST;
  if (!requestPath) return undefined;
  return validateRequest(JSON.parse(readFileSync(requestPath, "utf8")));
}

const request = configuredRequest();
const server = new McpServer({ name: "plan-and-subagent-ui-browser", version: "0.1.0" });
const conditions = new Set(request?.conditions.map((condition) => condition.id));
const viewports = new Map(request?.viewports.map((viewport) => [viewport.name, viewport]));
const consoleEntries = [];
const pageErrors = [];
let browser;
let context;
let page;
let artifactNumber = 0;

function requireRequest() {
  if (!request) throw new Error("Browser evidence requires PLAN_AND_SUBAGENT_UI_BROWSER_REQUEST from the UI/UX runner.");
  return request;
}

function requireCondition(conditionId) {
  requireRequest();
  if (!conditions.has(conditionId)) throw new Error(`Unknown condition ID: ${conditionId}`);
}

function safeName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "artifact";
}

function artifactPath(label, extension) {
  const active = requireRequest();
  artifactNumber += 1;
  mkdirSync(active.artifactDir, { recursive: true, mode: 0o700 });
  return assertPathWithin(active.artifactDir, path.join(active.artifactDir, `${String(artifactNumber).padStart(3, "0")}-${safeName(label)}.${extension}`), "artifact path");
}

async function ensurePage() {
  const active = requireRequest();
  if (page) return page;
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAN_AND_SUBAGENT_UI_BROWSER_EXECUTABLE || undefined });
  context = await browser.newContext({
    storageState: active.storageStatePath,
    viewport: { width: active.viewports[0].width, height: active.viewports[0].height },
  });
  await context.route("**/*", async (route) => {
    if (route.request().isNavigationRequest()) {
      try { assertAllowedPageUrl(active.allowedOrigins, route.request().url()); }
      catch { await route.abort("blockedbyclient"); return; }
    }
    await route.continue();
  });
  page = await context.newPage();
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleEntries.push({ type: message.type(), text: message.text().slice(0, 2_000) });
  });
  page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 4_000)));
  return page;
}

async function currentPage() {
  const active = requireRequest();
  const current = await ensurePage();
  if (current.url() !== "about:blank") assertAllowedPageUrl(active.allowedOrigins, current.url());
  return current;
}

function locate(current, params) {
  if (params.locator === "role") return current.getByRole(params.target, params.name ? { name: params.name, exact: true } : undefined).first();
  if (params.locator === "text") return current.getByText(params.target, { exact: true }).first();
  if (params.locator === "label") return current.getByLabel(params.target, { exact: true }).first();
  if (params.locator === "testId") return current.getByTestId(params.target).first();
  if (params.locator === "css") return current.locator(params.target).first();
  throw new Error(`Unsupported locator: ${params.locator}`);
}

function result(text) {
  return { content: [{ type: "text", text }] };
}

server.registerTool("navigate", {
  description: "Open an allowed top-level URL for an assigned UI verification condition.",
  inputSchema: { conditionId: z.string(), url: z.string() },
}, async ({ conditionId, url }) => {
  requireCondition(conditionId);
  const active = requireRequest();
  const target = assertAllowedPageUrl(active.allowedOrigins, url);
  const current = await ensurePage();
  await current.goto(target, { waitUntil: "domcontentloaded" });
  assertAllowedPageUrl(active.allowedOrigins, current.url());
  return result(`Opened ${current.url()} for ${conditionId}`);
});

server.registerTool("viewport", {
  description: "Switch to one named viewport declared in the UI verification request.",
  inputSchema: { conditionId: z.string(), viewport: z.string() },
}, async ({ conditionId, viewport }) => {
  requireCondition(conditionId);
  const selected = viewports.get(viewport);
  if (!selected) throw new Error(`Unknown viewport: ${viewport}`);
  const current = await currentPage();
  await current.setViewportSize({ width: selected.width, height: selected.height });
  return result(`Viewport ${selected.name}: ${selected.width}x${selected.height}`);
});

server.registerTool("act", {
  description: "Perform one scoped UI interaction. State-changing actions require explicit authorization in the request.",
  inputSchema: {
    conditionId: z.string(), action: z.enum(["click", "fill", "press", "hover", "scroll"]),
    locator: z.enum(["role", "text", "label", "testId", "css"]).optional(), target: z.string().optional(), name: z.string().optional(),
    value: z.string().optional(), key: z.string().optional(), deltaY: z.number().optional(), mayChangeExternalState: z.boolean(),
  },
}, async (params) => {
  requireCondition(params.conditionId);
  const active = requireRequest();
  if (params.mayChangeExternalState && !active.stateChangesAuthorized) throw new Error("The request does not authorize external state changes");
  const current = await currentPage();
  if (params.action === "scroll") await current.mouse.wheel(0, params.deltaY ?? 600);
  else {
    if (!params.locator || !params.target) throw new Error(`${params.action} requires locator and target`);
    const target = locate(current, params);
    if (params.action === "click") await target.click();
    if (params.action === "fill") await target.fill(params.value ?? "");
    if (params.action === "press") await target.press(params.key ?? "Enter");
    if (params.action === "hover") await target.hover();
  }
  await current.waitForTimeout(150);
  assertAllowedPageUrl(active.allowedOrigins, current.url());
  return result(`${params.action} completed for ${params.conditionId}`);
});

server.registerTool("capture", {
  description: "Capture the current viewport and accessibility snapshot as UI evidence.",
  inputSchema: { conditionId: z.string(), label: z.string() },
}, async ({ conditionId, label }) => {
  requireCondition(conditionId);
  const current = await currentPage();
  const outputPath = artifactPath(`${conditionId}-${label}`, "jpg");
  const image = await current.screenshot({ type: "jpeg", quality: 85, fullPage: false });
  writeFileSync(outputPath, image, { mode: 0o600 });
  let accessibility = "Accessibility snapshot unavailable";
  try { accessibility = (await current.locator("body").ariaSnapshot()).slice(0, 20_000); } catch { /* Screenshot is still usable evidence. */ }
  const dimensions = await current.evaluate(() => ({ viewportWidth: document.documentElement.clientWidth, viewportHeight: document.documentElement.clientHeight, contentWidth: document.documentElement.scrollWidth, contentHeight: document.documentElement.scrollHeight }));
  return { content: [{ type: "text", text: `Saved ${outputPath}\nURL: ${current.url()}\nDimensions: ${JSON.stringify(dimensions)}\nAccessibility:\n${accessibility}` }, { type: "image", data: image.toString("base64"), mimeType: "image/jpeg" }] };
});

server.registerTool("audit", {
  description: "Record horizontal overflow, accessibility, console, and page-error evidence.",
  inputSchema: { conditionId: z.string(), label: z.string() },
}, async ({ conditionId, label }) => {
  requireCondition(conditionId);
  const current = await currentPage();
  const overflow = await current.evaluate(() => ({ horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth, viewportWidth: document.documentElement.clientWidth, contentWidth: document.documentElement.scrollWidth }));
  const axe = await new AxeBuilder({ page: current }).analyze();
  const audit = { conditionId, url: current.url(), overflow, console: [...consoleEntries], pageErrors: [...pageErrors], axe: axe.violations.map((violation) => ({ id: violation.id, impact: violation.impact, help: violation.help, targets: violation.nodes.map((node) => node.target) })) };
  const outputPath = artifactPath(`${conditionId}-${label}-audit`, "json");
  writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`, { mode: 0o600 });
  return result(`Saved ${outputPath}\nHorizontal overflow: ${overflow.horizontal}\nAxe violations: ${audit.axe.length}\nConsole warnings/errors: ${audit.console.length}\nPage errors: ${audit.pageErrors.length}`);
});

process.on("exit", () => { void browser?.close(); });
await server.connect(new StdioServerTransport());
