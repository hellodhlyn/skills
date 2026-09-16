import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

test("requires provider and model values from the selected profile", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "pi-ui-runner-"));
  const requestPath = path.join(directory, "request.json");
  await writeFile(requestPath, JSON.stringify({
    phase: "final",
    workdir: process.cwd(),
    artifactDir: directory,
    codeState: "fixture:v1",
    url: "http://127.0.0.1:3000/",
    allowedOrigins: ["http://127.0.0.1:3000"],
    viewports: [{ name: "desktop", width: 800, height: 600 }],
    conditions: [{ id: "UI-1", expected: "Fixture renders", scenarios: ["Open"] }],
    stateChangesAuthorized: false,
  }));
  const env = { ...process.env };
  delete env.PI_UI_VERIFIER_PROVIDER;
  delete env.PI_UI_VERIFIER_MODEL;
  const result = spawnSync(process.execPath, ["src/run.mjs", requestPath], {
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    env,
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /PI_UI_VERIFIER_PROVIDER and PI_UI_VERIFIER_MODEL/);
});
