import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const helper = fileURLToPath(new URL("../cloud-teleport.py", import.meta.url));

function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cloud-teleport-test-")));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const receiver = path.join(root, "receiver");
  const bin = path.join(root, "bin");
  const config = path.join(root, "claude");
  fs.mkdirSync(receiver);
  fs.mkdirSync(bin);
  execFileSync("git", ["init", "-b", "feature/test"], { cwd: receiver, stdio: "pipe" });
  const fake = `#!${process.execPath}
const fs=require('node:fs');const path=require('node:path');
fs.writeFileSync(process.env.TELEPORT_ARGS,JSON.stringify(process.argv.slice(2)));
if(process.env.CLAUDE_CODE_CHILD_SESSION||process.env.CLAUDECODE)process.exit(9);
process.stdin.setRawMode(true);process.stdin.resume();
let stage='trust',keys='';
process.stdout.write('❯ No, exit\\nYes, I trust this folder\\n');
process.stdin.on('data',(data)=>{
  const value=data.toString();keys+=value;
  fs.writeFileSync(process.env.TELEPORT_KEYS,keys);
  if(stage==='trust'&&value==='\\x1b[B') {stage='selected';process.stdout.write('❯ Yes, I trust this folder\\n');}
  else if(stage==='selected'&&value==='\\r') {stage='ready';process.stdout.write('Imported history\\n❯ \\n? for shortcuts\\n');}
  else if(stage==='ready'&&value==='/exit\\r') {
    const project=path.join(process.env.CLAUDE_CONFIG_DIR,'projects',process.cwd().replace(/[^a-zA-Z0-9]/g,'-'));
    fs.mkdirSync(project,{recursive:true});
    fs.writeFileSync(path.join(project,'imported.jsonl'),JSON.stringify({type:'assistant',remoteSourced:true,message:{model:'claude-haiku-5-5'}})+'\\n');
    process.exit(0);
  } else process.exit(8);
});
`;
  fs.writeFileSync(path.join(bin, "claude"), fake, { mode: 0o755 });
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, CLAUDE_CONFIG_DIR: config,
    CLAUDECODE: "parent", CLAUDE_CODE_CHILD_SESSION: "parent",
    TELEPORT_ARGS: path.join(root, "args.json"), TELEPORT_KEYS: path.join(root, "keys.txt") };
  return { root, receiver, env };
}

test("PTY retrieval sends only the specific trust selection and exit, then copies official history", (t) => {
  const f = fixture(t);
  const report = path.join(f.root, "report");
  const result = spawnSync("python3", [helper, "session_test", f.receiver, report, "--timeout", "5"], {
    env: f.env, encoding: "utf8", timeout: 10000,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const data = JSON.parse(result.stdout);
  assert.equal(data.session_id, "session_test");
  assert.equal(fs.readFileSync(data.transcript, "utf8"), fs.readFileSync(data.source, "utf8"));
  assert.equal(fs.readFileSync(f.env.TELEPORT_KEYS, "utf8"), "\x1b[B\r/exit\r");
  assert.deepEqual(JSON.parse(fs.readFileSync(f.env.TELEPORT_ARGS)), ["--teleport", "session_test", "--permission-mode", "plan", "--setting-sources", "project"]);
});

test("a dirty receiver is rejected without starting the CLI", (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.receiver, "unrelated.txt"), "user change");
  const result = spawnSync("python3", [helper, "session_test", f.receiver, path.join(f.root, "report")], { env: f.env, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /clean repository/);
  assert.equal(fs.existsSync(f.env.TELEPORT_ARGS), false);
  assert.equal(fs.readFileSync(path.join(f.receiver, "unrelated.txt"), "utf8"), "user change");
});

test("an unknown interactive screen times out without answering it", (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, "bin/claude"), `#!${process.execPath}\nprocess.stdin.setRawMode(true);process.stdin.resume();process.stdout.write('Choose an account or sign in');process.stdin.on('data',()=>process.exit(8));\n`, { mode: 0o755 });
  const result = spawnSync("python3", [helper, "session_test", f.receiver, path.join(f.root, "report"), "--timeout", "1"], { env: f.env, encoding: "utf8", timeout: 5000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /timed out/);
  assert.equal(fs.existsSync(f.env.TELEPORT_KEYS), false);
});
