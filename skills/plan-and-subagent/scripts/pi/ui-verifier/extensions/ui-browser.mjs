import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { chromium } from "playwright";
import { Type } from "typebox";

import {
  assertAllowedPageUrl,
  assertPathWithin,
  validateReport,
  validateRequest,
} from "../src/request.mjs";

function loadRequest() {
  const requestPath = process.env.PI_UI_VERIFIER_REQUEST;
  const artifactDir = process.env.PI_UI_VERIFIER_ARTIFACT_DIR;
  if (!requestPath || !artifactDir) {
    throw new Error("PI_UI_VERIFIER_REQUEST and PI_UI_VERIFIER_ARTIFACT_DIR are required");
  }
  const request = validateRequest(JSON.parse(readFileSync(requestPath, "utf8")));
  if (path.resolve(request.artifactDir) !== path.resolve(artifactDir)) {
    throw new Error("request artifactDir does not match PI_UI_VERIFIER_ARTIFACT_DIR");
  }
  return { request, artifactDir: path.resolve(artifactDir) };
}

function fileSafe(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "artifact";
}

function textResult(text, details = {}) {
  return { content: [{ type: "text", text }], details };
}

export default function uiBrowserExtension(pi) {
  const { request, artifactDir } = loadRequest();
  const conditionIds = new Set(request.conditions.map((condition) => condition.id));
  const viewports = new Map(request.viewports.map((viewport) => [viewport.name, viewport]));
  const consoleEntries = [];
  const pageErrors = [];
  let browser;
  let context;
  let page;
  let artifactNumber = 0;

  function requireCondition(conditionId) {
    if (!conditionIds.has(conditionId)) {
      throw new Error(`Unknown condition ID: ${conditionId}`);
    }
  }

  function artifactPath(label, extension) {
    artifactNumber += 1;
    return assertPathWithin(
      artifactDir,
      path.join(artifactDir, `${String(artifactNumber).padStart(3, "0")}-${fileSafe(label)}.${extension}`),
      "artifact path",
    );
  }

  async function ensurePage() {
    if (page) return page;
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PI_UI_VERIFIER_BROWSER_EXECUTABLE || undefined,
    });
    context = await browser.newContext({
      storageState: request.storageStatePath,
      viewport: request.viewports[0]
        ? { width: request.viewports[0].width, height: request.viewports[0].height }
        : undefined,
    });
    await context.route("**/*", async (route) => {
      const navigation = route.request().isNavigationRequest();
      if (navigation) {
        try {
          assertAllowedPageUrl(request.allowedOrigins, route.request().url());
        } catch {
          await route.abort("blockedbyclient");
          return;
        }
      }
      await route.continue();
    });
    page = await context.newPage();
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleEntries.push({ type: message.type(), text: message.text().slice(0, 2_000) });
      }
    });
    page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 4_000)));
    return page;
  }

  async function currentPage() {
    const current = await ensurePage();
    if (current.url() !== "about:blank") {
      assertAllowedPageUrl(request.allowedOrigins, current.url());
    }
    return current;
  }

  async function closeBrowser() {
    if (browser) await browser.close();
    browser = undefined;
    context = undefined;
    page = undefined;
  }

  function locate(current, params) {
    switch (params.locator) {
      case "role":
        return current.getByRole(params.target, params.name ? { name: params.name, exact: true } : undefined).first();
      case "text":
        return current.getByText(params.target, { exact: true }).first();
      case "label":
        return current.getByLabel(params.target, { exact: true }).first();
      case "testId":
        return current.getByTestId(params.target).first();
      case "css":
        return current.locator(params.target).first();
      default:
        throw new Error(`Unsupported locator: ${params.locator}`);
    }
  }

  pi.registerTool(defineTool({
    name: "browser_navigate",
    label: "Navigate verifier browser",
    description: "Open an allowed top-level URL for an assigned condition.",
    parameters: Type.Object({
      conditionId: Type.String(),
      url: Type.String(),
    }),
    async execute(_id, params) {
      requireCondition(params.conditionId);
      const target = assertAllowedPageUrl(request.allowedOrigins, params.url);
      const current = await ensurePage();
      await current.goto(target, { waitUntil: "domcontentloaded" });
      assertAllowedPageUrl(request.allowedOrigins, current.url());
      return textResult(`Opened ${current.url()} for ${params.conditionId}`, {
        conditionId: params.conditionId,
        url: current.url(),
      });
    },
  }));

  pi.registerTool(defineTool({
    name: "browser_viewport",
    label: "Set verifier viewport",
    description: "Switch to one named viewport declared in the verification request.",
    parameters: Type.Object({
      conditionId: Type.String(),
      viewport: Type.String(),
    }),
    async execute(_id, params) {
      requireCondition(params.conditionId);
      const viewport = viewports.get(params.viewport);
      if (!viewport) throw new Error(`Unknown viewport: ${params.viewport}`);
      const current = await currentPage();
      await current.setViewportSize({ width: viewport.width, height: viewport.height });
      return textResult(`Viewport ${viewport.name}: ${viewport.width}x${viewport.height}`, {
        conditionId: params.conditionId,
        viewport,
      });
    },
  }));

  pi.registerTool(defineTool({
    name: "browser_act",
    label: "Interact with verifier browser",
    description: "Perform one scoped interaction on the current allowed page.",
    parameters: Type.Object({
      conditionId: Type.String(),
      action: Type.Union([
        Type.Literal("click"),
        Type.Literal("fill"),
        Type.Literal("press"),
        Type.Literal("hover"),
        Type.Literal("scroll"),
      ]),
      locator: Type.Optional(Type.Union([
        Type.Literal("role"),
        Type.Literal("text"),
        Type.Literal("label"),
        Type.Literal("testId"),
        Type.Literal("css"),
      ])),
      target: Type.Optional(Type.String()),
      name: Type.Optional(Type.String()),
      value: Type.Optional(Type.String()),
      key: Type.Optional(Type.String()),
      deltaY: Type.Optional(Type.Number()),
      mayChangeExternalState: Type.Boolean(),
    }),
    async execute(_id, params) {
      requireCondition(params.conditionId);
      if (params.mayChangeExternalState && !request.stateChangesAuthorized) {
        throw new Error("The request does not authorize external state changes");
      }
      const current = await currentPage();
      if (params.action === "scroll") {
        await current.mouse.wheel(0, params.deltaY ?? 600);
      } else {
        if (!params.locator || !params.target) {
          throw new Error(`${params.action} requires locator and target`);
        }
        const target = locate(current, params);
        if (params.action === "click") await target.click();
        if (params.action === "fill") await target.fill(params.value ?? "");
        if (params.action === "press") await target.press(params.key ?? "Enter");
        if (params.action === "hover") await target.hover();
      }
      await current.waitForTimeout(150);
      assertAllowedPageUrl(request.allowedOrigins, current.url());
      return textResult(`${params.action} completed for ${params.conditionId}`, {
        conditionId: params.conditionId,
        action: params.action,
        url: current.url(),
      });
    },
  }));

  pi.registerTool(defineTool({
    name: "browser_capture",
    label: "Capture visual evidence",
    description: "Capture the current viewport and a concise accessibility snapshot.",
    parameters: Type.Object({
      conditionId: Type.String(),
      label: Type.String(),
    }),
    async execute(_id, params) {
      requireCondition(params.conditionId);
      const current = await currentPage();
      const outputPath = artifactPath(`${params.conditionId}-${params.label}`, "jpg");
      const image = await current.screenshot({ type: "jpeg", quality: 85, fullPage: false });
      writeFileSync(outputPath, image, { mode: 0o600 });
      let accessibility = "Accessibility snapshot unavailable";
      try {
        accessibility = (await current.locator("body").ariaSnapshot()).slice(0, 20_000);
      } catch {
        // The screenshot remains valid visual evidence when ariaSnapshot is unavailable.
      }
      const dimensions = await current.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: document.documentElement.clientHeight,
        contentWidth: document.documentElement.scrollWidth,
        contentHeight: document.documentElement.scrollHeight,
      }));
      return {
        content: [
          {
            type: "text",
            text: `Saved ${outputPath}\nURL: ${current.url()}\nDimensions: ${JSON.stringify(dimensions)}\nAccessibility:\n${accessibility}`,
          },
          { type: "image", data: image.toString("base64"), mimeType: "image/jpeg" },
        ],
        details: { conditionId: params.conditionId, outputPath, url: current.url(), dimensions },
      };
    },
  }));

  pi.registerTool(defineTool({
    name: "browser_audit",
    label: "Run deterministic UI audit",
    description: "Record overflow, axe, console, and page-error evidence for an assigned condition.",
    parameters: Type.Object({
      conditionId: Type.String(),
      label: Type.String(),
    }),
    async execute(_id, params) {
      requireCondition(params.conditionId);
      const current = await currentPage();
      const overflow = await current.evaluate(() => ({
        horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        viewportWidth: document.documentElement.clientWidth,
        contentWidth: document.documentElement.scrollWidth,
      }));
      const axe = await new AxeBuilder({ page: current }).analyze();
      const audit = {
        conditionId: params.conditionId,
        url: current.url(),
        overflow,
        console: [...consoleEntries],
        pageErrors: [...pageErrors],
        axe: axe.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          helpUrl: violation.helpUrl,
          targets: violation.nodes.map((node) => node.target),
        })),
      };
      const outputPath = artifactPath(`${params.conditionId}-${params.label}-audit`, "json");
      writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`, { mode: 0o600 });
      return textResult(
        `Saved ${outputPath}\nHorizontal overflow: ${overflow.horizontal}\nAxe violations: ${audit.axe.length}\nConsole warnings/errors: ${audit.console.length}\nPage errors: ${audit.pageErrors.length}`,
        { conditionId: params.conditionId, outputPath, audit },
      );
    },
  }));

  pi.registerTool(defineTool({
    name: "submit_ui_verification",
    label: "Submit UI verification",
    description: "Submit the complete condition-by-condition report and terminate the verification turn.",
    promptSnippet: "Submit the final UI verification report",
    promptGuidelines: ["Call submit_ui_verification exactly once as the final action."],
    parameters: Type.Object({
      summary: Type.String(),
      conditions: Type.Array(Type.Object({
        id: Type.String(),
        status: Type.Union([
          Type.Literal("PASS"),
          Type.Literal("FAIL"),
          Type.Literal("UNVERIFIED"),
          Type.Literal("DECISION_REQUIRED"),
        ]),
        observation: Type.String(),
        evidence: Type.Array(Type.String()),
        reproductionSteps: Type.Array(Type.String()),
        userImpact: Type.Optional(Type.String()),
        correctionDirection: Type.Optional(Type.String()),
      })),
      findings: Type.Array(Type.Object({
        id: Type.String(),
        title: Type.String(),
        conditionId: Type.String(),
        trigger: Type.String(),
        impact: Type.String(),
        evidence: Type.Array(Type.String()),
        correctionDirection: Type.String(),
      })),
      limitations: Type.Array(Type.String()),
    }),
    async execute(_id, params) {
      const report = validateReport(params, request);
      const outputPath = assertPathWithin(artifactDir, path.join(artifactDir, "report.json"), "report path");
      writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600, flag: "wx" });
      await closeBrowser();
      return {
        content: [{ type: "text", text: `Saved complete UI verification report to ${outputPath}` }],
        details: { outputPath },
        terminate: true,
      };
    },
  }));

  pi.on("session_shutdown", closeBrowser);
}
