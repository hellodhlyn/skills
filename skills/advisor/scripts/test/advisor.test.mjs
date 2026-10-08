import assert from "node:assert/strict";
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const packageName = "@anthropic-ai/claude-agent-sdk";

function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "advisor-local-sdk-test-")));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const skill = path.join(root, "skill");
  fs.cpSync(path.join(skillRoot, "scripts"), path.join(skill, "scripts"), {
    recursive: true, filter: (source) => path.basename(source) !== "test",
  });
  fs.cpSync(path.join(skillRoot, "references"), path.join(skill, "references"), { recursive: true });
  const workdir = path.join(root, "repo");
  const bin = path.join(root, "bin");
  const globalRoot = path.join(root, "global", "node_modules");
  fs.mkdirSync(workdir);
  fs.mkdirSync(bin);
  fs.mkdirSync(globalRoot, { recursive: true });
  fs.symlinkSync(process.execPath, path.join(bin, "node"));
  const npmLog = path.join(root, "npm-argv.json");
  fs.writeFileSync(path.join(bin, "npm"), `#!${process.execPath}
const fs = require('node:fs');
fs.writeFileSync(process.env.ADVISOR_TEST_NPM_LOG, JSON.stringify(process.argv.slice(2)));
console.log(process.env.ADVISOR_TEST_GLOBAL_ROOT);
`, { mode: 0o755 });

  function sdk(directory, version = "9.8.7", source) {
    fs.mkdirSync(path.join(directory, "dist"), { recursive: true });
    fs.writeFileSync(path.join(directory, "package.json"), JSON.stringify({
      name: packageName, version, type: "module", exports: { ".": "./dist/sdk.mjs" },
    }));
    fs.writeFileSync(path.join(directory, "dist", "sdk.mjs"), source ?? `
import {writeFileSync} from 'node:fs';
export async function* query({prompt, options}) {
  writeFileSync(process.env.ADVISOR_TEST_QUERY, JSON.stringify({prompt, options}));
  yield {type:'result', subtype:'success', is_error:false, structured_output:{
    recommendation:'Use the existing design.', evidence:['Observed repository behavior.'],
    risks:['Check compatibility.'], alternatives:['A larger rewrite.'], next_step:'Validate the change.'
  }};
}
`);
    return directory;
  }

  const queryPath = path.join(root, "query.json");
  function execute(overrides = {}) {
    return spawnSync("/bin/bash", [path.join(skill, "scripts", "advisor.sh"), workdir], {
      input: "Inspect the repository and advise.\n", encoding: "utf8", timeout: 10000,
      env: { ...process.env, PATH: `${bin}:/usr/bin:/bin`, NODE_PATH: "", ADVISOR_SDK_PACKAGE_DIR: "",
        CLAUDE_CODE_OAUTH_TOKEN: "test-oauth-token", ADVISOR_TEST_NPM_LOG: npmLog,
        ADVISOR_TEST_GLOBAL_ROOT: globalRoot, ADVISOR_TEST_QUERY: queryPath, ...overrides },
    });
  }
  function artifacts(child) {
    const directory = child.stderr.match(/^Advisor run directory: (.+)$/m)?.[1];
    assert.ok(directory, child.stderr);
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return {
      directory, metadata: JSON.parse(fs.readFileSync(path.join(directory, "metadata.json"), "utf8")),
      exitCode: fs.readFileSync(path.join(directory, "exit_code"), "utf8"),
    };
  }
  return { root, skill, workdir, globalRoot, npmLog, queryPath, sdk, execute, artifacts };
}

for (const version of ["1.2.3", "9.8.7"]) {
  test(`uses the explicitly selected local SDK ${version} and records its actual version`, (t) => {
    const f = fixture(t);
    const directory = f.sdk(path.join(f.root, "selected", "node_modules", packageName), version);
    const child = f.execute({ ADVISOR_SDK_PACKAGE_DIR: directory });
    assert.equal(child.status, 0, child.stderr);
    const artifacts = f.artifacts(child);
    assert.equal(artifacts.metadata.sdk, `${packageName}@${version}`);
    assert.equal(artifacts.metadata.sdk_path, directory);
    assert.equal(artifacts.exitCode, "0\n");
    assert.equal(fs.existsSync(f.npmLog), false);
    const { prompt, options } = JSON.parse(fs.readFileSync(f.queryPath, "utf8"));
    assert.equal(prompt, "Inspect the repository and advise.");
    assert.equal(options.cwd, f.workdir);
    assert.equal(options.model, "claude-opus-5-5");
    assert.equal(options.effort, "medium");
    assert.equal(options.sandbox.enabled, true);
    assert.equal(options.sandbox.failIfUnavailable, true);
    assert.deepEqual(options.sandbox.filesystem.denyWrite, [f.workdir]);
    assert.equal(options.sandbox.allowUnsandboxedCommands, false);
  });
}

test("uses normal Node module resolution before npm global lookup", (t) => {
  const f = fixture(t);
  const modules = path.join(f.root, "local-modules");
  const directory = f.sdk(path.join(modules, packageName));
  const child = f.execute({ NODE_PATH: modules });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(f.artifacts(child).metadata.sdk_path, directory);
  assert.equal(fs.existsSync(f.npmLog), false);
});

test("uses the active npm global installation without installing a dependency", (t) => {
  const f = fixture(t);
  const directory = f.sdk(path.join(f.globalRoot, packageName));
  const child = f.execute();
  assert.equal(child.status, 0, child.stderr);
  assert.equal(f.artifacts(child).metadata.sdk_path, directory);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.npmLog, "utf8")), ["root", "-g"]);
});

test("missing SDK fails explicitly, records failure, and never installs or calls a model", (t) => {
  const f = fixture(t);
  const child = f.execute();
  assert.equal(child.status, 1, child.stderr);
  const artifacts = f.artifacts(child);
  assert.equal(artifacts.metadata.status, "error");
  assert.match(artifacts.metadata.error, /Local .* is unavailable/);
  assert.equal(artifacts.exitCode, "1\n");
  assert.equal(fs.existsSync(path.join(artifacts.directory, "result.md")), false);
  assert.equal(fs.existsSync(f.queryPath), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.npmLog, "utf8")), ["root", "-g"]);
});

for (const selected of ["relative/path", "missing", "wrong-package"]) {
  test(`an invalid explicit SDK (${selected}) never switches to another installation`, (t) => {
    const f = fixture(t);
    f.sdk(path.join(f.globalRoot, packageName));
    let directory = selected === "relative/path" ? selected : path.join(f.root, selected);
    if (selected === "wrong-package") {
      fs.mkdirSync(directory);
      fs.writeFileSync(path.join(directory, "package.json"), JSON.stringify({ name: "other-package", version: "1.0.0" }));
    }
    const child = f.execute({ ADVISOR_SDK_PACKAGE_DIR: directory });
    assert.equal(child.status, 1, child.stderr);
    assert.equal(f.artifacts(child).metadata.status, "error");
    assert.equal(fs.existsSync(f.npmLog), false);
    assert.equal(fs.existsSync(f.queryPath), false);
  });
}

test("incompatible SDK fails instead of publishing advice", (t) => {
  const f = fixture(t);
  const directory = f.sdk(path.join(f.root, "selected", "node_modules", packageName), "9.8.7", "export const unsupported = true;\n");
  const child = f.execute({ ADVISOR_SDK_PACKAGE_DIR: directory });
  assert.equal(child.status, 1, child.stderr);
  const artifacts = f.artifacts(child);
  assert.equal(artifacts.metadata.sdk, `${packageName}@9.8.7`);
  assert.match(artifacts.metadata.error, /does not export query/);
  assert.equal(fs.existsSync(path.join(artifacts.directory, "result.md")), false);
});
