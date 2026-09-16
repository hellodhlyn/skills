import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

test("captures screenshot and deterministic audit through the Pi extension", {
  skip: !process.env.PI_UI_VERIFIER_BROWSER_EXECUTABLE,
}, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "pi-ui-browser-"));
  let blockedRequests = 0;
  const blockedServer = createServer((_request, response) => {
    blockedRequests += 1;
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><title>Blocked origin</title>");
  });
  await new Promise((resolve) => blockedServer.listen(0, "127.0.0.1", resolve));
  const blockedAddress = blockedServer.address();
  const blockedOrigin = `http://127.0.0.1:${blockedAddress.port}`;
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><html lang="en"><head><title>Verifier fixture</title></head>
      <body><main><h1>Verifier fixture</h1><button type="button">Continue</button>
      <a href="${blockedOrigin}">Leave</a></main></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const requestPath = path.join(directory, "request.json");
  await writeFile(requestPath, JSON.stringify({
    phase: "final",
    workdir: process.cwd(),
    artifactDir: directory,
    codeState: "fixture:v1",
    url: origin,
    allowedOrigins: [origin],
    viewports: [{ name: "desktop", width: 800, height: 600 }],
    conditions: [{ id: "UI-1", expected: "Fixture renders", scenarios: ["Open and capture"] }],
    stateChangesAuthorized: false,
  }));

  process.env.PI_UI_VERIFIER_REQUEST = requestPath;
  process.env.PI_UI_VERIFIER_ARTIFACT_DIR = directory;
  const tools = new Map();
  const module = await import(`../extensions/ui-browser.mjs?smoke=${Date.now()}`);
  module.default({
    registerTool(tool) {
      tools.set(tool.name, tool);
    },
    on() {},
  });

  try {
    await tools.get("browser_navigate").execute("1", { conditionId: "UI-1", url: origin });
    const capture = await tools.get("browser_capture").execute(
      "2",
      { conditionId: "UI-1", label: "desktop" },
    );
    const audit = await tools.get("browser_audit").execute(
      "3",
      { conditionId: "UI-1", label: "desktop" },
    );
    await assert.rejects(() => tools.get("browser_act").execute("blocked-navigation", {
      conditionId: "UI-1",
      action: "click",
      locator: "role",
      target: "link",
      name: "Leave",
      mayChangeExternalState: false,
    }));
    assert.equal(blockedRequests, 0);
    await tools.get("submit_ui_verification").execute("4", {
      summary: "Fixture verified",
      conditions: [{
        id: "UI-1",
        status: "PASS",
        observation: "Fixture rendered at the requested viewport",
        evidence: [capture.details.outputPath, audit.details.outputPath],
        reproductionSteps: ["Open the fixture", "Capture and audit"],
      }],
      findings: [],
      limitations: [],
    });
    const report = JSON.parse(await readFile(path.join(directory, "report.json"), "utf8"));
    assert.equal(report.conditions[0].status, "PASS");
    const entries = await import("node:fs/promises").then(({ readdir }) => readdir(directory));
    assert.ok(entries.some((entry) => entry.endsWith(".jpg")));
    assert.ok(entries.some((entry) => entry.endsWith("-audit.json")));
  } finally {
    server.close();
    blockedServer.close();
    delete process.env.PI_UI_VERIFIER_REQUEST;
    delete process.env.PI_UI_VERIFIER_ARTIFACT_DIR;
  }
});
