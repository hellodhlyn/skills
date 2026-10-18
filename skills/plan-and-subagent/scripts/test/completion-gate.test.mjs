import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'completion-gate.mjs');
const roots = [];

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function run(...args) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function validGate() {
  return {
    schema: 1,
    approvedBrief: 'approved_brief.md',
    codeState: { baseline: 'abc123', inspected: 'def456' },
    approval: { mode: 'approved', record: 'decisions.md' },
    requirementsValidation: { result: 'PASS', round: 1, report: 'reviews/primary/round-1.md' },
    externalReview: { result: 'PASS', round: 1, report: 'reviews/external/round-1/result.md' },
    resultConfirmation: { required: false },
    delivery: { scope: 'commit, push, pull request', ceiling: 'pull-request' },
    conditions: [{ id: 'C1', state: 'PASS' }, { id: 'C2', state: 'PASS' }],
  };
}

// Builds a session directory with every referenced file, then applies mutate(gate).
function fixture(mutate, { writeGate = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'completion-gate-'));
  roots.push(dir);
  for (const file of [
    'approved_brief.md',
    'decisions.md',
    'confirmation.md',
    'reviews/primary/round-1.md',
    'reviews/external/round-1/result.md',
  ]) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), 'x\n');
  }
  const gate = validGate();
  if (mutate) mutate(gate);
  if (writeGate) {
    mkdirSync(join(dir, 'reviews'), { recursive: true });
    writeFileSync(join(dir, 'reviews', 'completion-gate.json'), JSON.stringify(gate));
  }
  return dir;
}

function assertFails(mutate, pattern) {
  const result = run('verify', fixture(mutate));
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, pattern);
}

describe('verify', () => {
  test('passes a complete record', () => {
    const result = run('verify', fixture());
    assert.equal(result.status, 0, result.stderr);
  });

  test('passes auto-proceed mode and required confirmation with a record', () => {
    const dir = fixture((g) => {
      g.approval.mode = 'auto-proceed';
      g.resultConfirmation = { required: true, record: 'confirmation.md' };
      g.delivery.ceiling = 'none';
    });
    assert.equal(run('verify', dir).status, 0);
  });

  test('fails when the record file is missing', () => {
    const result = run('verify', fixture(null, { writeGate: false }));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /completion-gate\.json does not exist/);
  });

  test('fails when the session directory is missing', () => {
    const result = run('verify', join(tmpdir(), 'completion-gate-no-such-dir'));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /session directory does not exist/);
  });

  test('fails on invalid JSON', () => {
    const dir = fixture(null, { writeGate: false });
    mkdirSync(join(dir, 'reviews'), { recursive: true });
    writeFileSync(join(dir, 'reviews', 'completion-gate.json'), '{ not json');
    const result = run('verify', dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /not valid JSON/);
  });

  test('fails on a wrong schema', () => {
    assertFails((g) => { g.schema = 2; }, /schema must be 1/);
  });

  test('fails on an empty code state', () => {
    assertFails((g) => { g.codeState.baseline = ''; g.codeState.inspected = '  '; },
      /codeState\.baseline[\s\S]*codeState\.inspected/);
  });

  test('fails when the approved brief is missing', () => {
    assertFails((g) => { g.approvedBrief = 'nope.md'; }, /approvedBrief does not name an existing file/);
  });

  test('fails on an invalid approval mode and missing approval record', () => {
    assertFails((g) => { g.approval.mode = 'waived'; g.approval.record = 'nope.md'; },
      /approval\.mode[\s\S]*approval\.record/);
  });

  test('fails when requirements validation is not a passing round with a report', () => {
    assertFails((g) => {
      g.requirementsValidation = { result: 'FAIL', round: 0, report: 'nope.md' };
    }, /requirementsValidation\.result[\s\S]*requirementsValidation\.round[\s\S]*requirementsValidation\.report/);
  });

  test('fails when external review is not a passing round with a report', () => {
    assertFails((g) => {
      g.externalReview = { result: 'INCONCLUSIVE', round: 1.5, report: 'nope.md' };
    }, /externalReview\.result[\s\S]*externalReview\.round[\s\S]*externalReview\.report/);
  });

  test('fails when required result confirmation has no existing record', () => {
    assertFails((g) => { g.resultConfirmation = { required: true }; },
      /resultConfirmation\.record/);
    assertFails((g) => { g.resultConfirmation = { required: true, record: 'nope.md' }; },
      /resultConfirmation\.record does not name an existing file/);
  });

  test('fails when result confirmation requirement is not a boolean', () => {
    assertFails((g) => { g.resultConfirmation = {}; }, /resultConfirmation\.required must be true or false/);
  });

  test('fails on an empty delivery scope or unknown ceiling', () => {
    assertFails((g) => { g.delivery = { scope: '', ceiling: 'merge' }; },
      /delivery\.scope[\s\S]*delivery\.ceiling/);
  });

  test('fails on empty conditions and non-PASS conditions', () => {
    assertFails((g) => { g.conditions = []; }, /conditions must be a non-empty array/);
    assertFails((g) => { g.conditions = [{ id: 'C1', state: 'UNVERIFIED' }, { state: 'PASS' }]; },
      /C1[\s\S]*conditions\[1\]\.id/);
  });

  test('rejects files that escape the session directory', () => {
    const outside = join(tmpdir(), `completion-gate-outside-${process.pid}.md`);
    writeFileSync(outside, 'x\n');
    roots.push(outside);
    assertFails((g) => { g.approvedBrief = `../${outside.split('/').pop()}`; },
      /approvedBrief must be under the session directory/);
  });

  test('reports every violation on its own line', () => {
    const dir = fixture((g) => { g.schema = 0; g.conditions = []; g.delivery.ceiling = 'x'; });
    const lines = run('verify', dir).stderr.trim().split('\n');
    assert.equal(lines.length, 3);
  });
});

describe('template and usage', () => {
  test('template prints a JSON skeleton with the required keys', () => {
    const result = run('template');
    assert.equal(result.status, 0);
    const gate = JSON.parse(result.stdout);
    assert.equal(gate.schema, 1);
    for (const key of ['approvedBrief', 'codeState', 'approval', 'requirementsValidation',
      'externalReview', 'resultConfirmation', 'delivery', 'conditions']) {
      assert.ok(key in gate, key);
    }
  });

  test('template output is not accepted as is', () => {
    const dir = mkdtempSync(join(tmpdir(), 'completion-gate-'));
    roots.push(dir);
    mkdirSync(join(dir, 'reviews'), { recursive: true });
    writeFileSync(join(dir, 'reviews', 'completion-gate.json'), run('template').stdout);
    assert.equal(run('verify', dir).status, 1);
  });

  test('usage errors exit 2', () => {
    assert.equal(run().status, 2);
    assert.equal(run('verify').status, 2);
    assert.equal(run('verify', 'a', 'b').status, 2);
    assert.equal(run('template', 'extra').status, 2);
    assert.equal(run('bogus').status, 2);
  });
});
