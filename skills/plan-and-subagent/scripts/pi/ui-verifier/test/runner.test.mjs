import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parseArguments } from "../src/run.mjs";

test("requires explicit provider and model arguments from the selected profile", () => {
  assert.deepEqual(parseArguments(["--provider", "opencode-go", "--model", "glm-5.3-flash", "request.json"]), {
    provider: "opencode-go",
    model: "glm-5.3-flash",
    requestPath: "request.json",
  });
  assert.throws(() => parseArguments(["request.json"]), /--provider, --model/);
  assert.throws(() => parseArguments(["--provider", "opencode-go", "request.json", "extra"]), /Unexpected argument/);
});

test("does not use environment variables as the provider/model source", async () => {
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
  env.PI_UI_VERIFIER_PROVIDER = "wrong-provider";
  env.PI_UI_VERIFIER_MODEL = "wrong-model";
  const result = spawnSync(process.execPath, ["src/run.mjs", requestPath], {
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    env,
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--provider, --model/);
});
