import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { PiRpcClient } from "../src/rpc-client.mjs";

test("correlates prompt responses and waits for agent_settled", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "pi-ui-rpc-"));
  const fixture = fileURLToPath(new URL("../fixtures/fake-pi.mjs", import.meta.url));
  const eventsPath = path.join(directory, "events.jsonl");
  const stderrPath = path.join(directory, "stderr.log");
  const client = new PiRpcClient({
    command: process.execPath,
    args: [fixture, "--provider", "opencode-go", "--model", "glm-5.3-flash"],
    cwd: process.cwd(),
    env: process.env,
    eventsPath,
    stderrPath,
  });

  await client.start();
  const state = await client.getState();
  assert.equal(state.model.provider, "opencode-go");
  assert.equal(state.model.id, "glm-5.3-flash");
  assert.deepEqual(state.model.input, ["text", "image"]);
  await client.prompt("verify");
  await client.waitForSettled(1_000);
  assert.equal(client.agentSettled, true);
  const exit = await client.stop();
  assert.deepEqual(exit, { code: 0, signal: null });
  const events = await readFile(eventsPath, "utf8");
  assert.match(events, /agent_settled/);
});
