#!/usr/bin/env node
import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { validateReport, validateRequest, realWorkdir } from "./request.mjs";
import { PiRpcClient } from "./rpc-client.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  console.error("Usage: node src/run.mjs <request.json>");
  process.exit(2);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function main() {
  if (process.argv.length !== 3) usage();
  const requestPath = path.resolve(process.argv[2]);
  const request = validateRequest(await readJson(requestPath));
  const workdir = realWorkdir(request.workdir);
  await mkdir(request.artifactDir, { recursive: true, mode: 0o700 });
  const artifactDir = realWorkdir(request.artifactDir);

  const piBinary = path.join(packageRoot, "node_modules", ".bin", "pi");
  const extensionPath = path.join(packageRoot, "extensions", "ui-browser.mjs");
  const systemPromptPath = path.join(packageRoot, "prompts", "ui-verifier.md");
  await access(piBinary, constants.X_OK);
  await access(extensionPath, constants.R_OK);

  const provider = process.env.PI_UI_VERIFIER_PROVIDER;
  const model = process.env.PI_UI_VERIFIER_MODEL;
  if (!provider || !model) {
    throw new Error("PI_UI_VERIFIER_PROVIDER and PI_UI_VERIFIER_MODEL must be supplied by the selected profile");
  }
  const timeoutMs = Number(process.env.PI_UI_VERIFIER_TIMEOUT_MS || 900_000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000) {
    throw new Error("PI_UI_VERIFIER_TIMEOUT_MS must be an integer of at least 1000");
  }

  const systemPrompt = await readFile(systemPromptPath, "utf8");
  const prompt = [
    "Verify the following implemented UI request. The JSON is authoritative.",
    "Use only the exposed browser and report tools. Finish with submit_ui_verification.",
    JSON.stringify(request, null, 2),
  ].join("\n\n");

  const eventsPath = path.join(artifactDir, "events.jsonl");
  const stderrPath = path.join(artifactDir, "stderr.log");
  const executionPath = path.join(artifactDir, "execution.json");
  const reportPath = path.join(artifactDir, "report.json");
  const startedAt = new Date().toISOString();
  let client;
  let failure;
  let childExit;

  try {
    client = new PiRpcClient({
      command: piBinary,
      args: [
        "--mode", "rpc",
        "--no-session",
        "--no-context-files",
        "--no-extensions",
        "--no-skills",
        "--no-prompt-templates",
        "--no-builtin-tools",
        "--tools", "browser_navigate,browser_viewport,browser_act,browser_capture,browser_audit,submit_ui_verification",
        "--extension", extensionPath,
        "--provider", provider,
        "--model", model,
        "--system-prompt", systemPrompt,
      ],
      cwd: workdir,
      env: {
        ...process.env,
        PI_UI_VERIFIER_REQUEST: requestPath,
        PI_UI_VERIFIER_ARTIFACT_DIR: artifactDir,
      },
      eventsPath,
      stderrPath,
    });
    await client.start();
    const state = await client.getState();
    if (state?.model?.provider !== provider || state?.model?.id !== model) {
      throw new Error(
        `Pi selected an unexpected model: ${state?.model?.provider || "none"}/${state?.model?.id || "none"}`,
      );
    }
    if (!Array.isArray(state.model.input) || !state.model.input.includes("image")) {
      throw new Error(`Pi model ${provider}/${model} does not advertise image input support`);
    }
    await client.prompt(prompt);
    await client.waitForSettled(timeoutMs);
    childExit = await client.stop();
    const report = validateReport(await readJson(reportPath), request);
    await writeFile(
      executionPath,
      `${JSON.stringify({
        status: "completed",
        provider,
        model,
        phase: request.phase,
        codeState: request.codeState,
        startedAt,
        completedAt: new Date().toISOString(),
        agentSettled: true,
        childExit,
        reportPath,
      }, null, 2)}\n`,
      { mode: 0o600 },
    );
    console.log(reportPath);
  } catch (error) {
    failure = error;
    if (client) {
      await client.abort();
      childExit = await client.stop();
    }
    await writeFile(
      executionPath,
      `${JSON.stringify({
        status: "failed",
        provider,
        model,
        phase: request.phase,
        codeState: request.codeState,
        startedAt,
        completedAt: new Date().toISOString(),
        agentSettled: client?.agentSettled === true,
        childExit,
        error: error instanceof Error ? error.message : String(error),
      }, null, 2)}\n`,
      { mode: 0o600 },
    );
  }

  if (failure) throw failure;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
