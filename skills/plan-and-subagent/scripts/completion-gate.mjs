#!/usr/bin/env node
// Completion-gate verifier for plan-and-subagent.
// Usage:
//   node completion-gate.mjs verify <SESSION_DIR>
//   node completion-gate.mjs template
// Exit codes: 0 verified (or template printed), 1 violations found, 2 usage error.

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const APPROVAL_MODES = ['approved', 'auto-proceed'];
const CEILINGS = ['none', 'local-commit', 'pull-request'];

export function template() {
  return {
    schema: 1,
    approvedBrief: 'approved_brief.md',
    codeState: {
      baseline: '<baseline commit or ref>',
      inspected: '<inspected commit, or git status and diff stat for uncommitted work>',
    },
    approval: { mode: 'approved', record: 'decisions.md' },
    requirementsValidation: { result: 'PASS', round: 1, report: 'reviews/primary/round-1.md' },
    externalReview: { result: 'PASS', round: 1, report: 'reviews/external/round-1/triage.md' },
    resultConfirmation: { required: false },
    delivery: { scope: '<effective delivery scope from the approved brief>', ceiling: 'none' },
    conditions: [{ id: 'C1', state: 'PASS' }],
  };
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';

export function verify(sessionDir) {
  const violations = [];
  const fail = (message) => violations.push(message);

  if (!existsSync(sessionDir) || !statSync(sessionDir).isDirectory()) {
    return [`session directory does not exist: ${sessionDir}`];
  }
  const root = realpathSync(sessionDir);
  const gatePath = resolve(root, 'reviews', 'completion-gate.json');
  if (!existsSync(gatePath)) {
    return ['reviews/completion-gate.json does not exist'];
  }

  let gate;
  try {
    gate = JSON.parse(readFileSync(gatePath, 'utf8'));
  } catch (error) {
    return [`reviews/completion-gate.json is not valid JSON: ${error.message}`];
  }
  if (!isObject(gate)) {
    return ['reviews/completion-gate.json must contain a JSON object'];
  }

  const checkFile = (label, value) => {
    if (!isNonEmptyString(value)) {
      fail(`${label} must name a file under the session directory`);
      return;
    }
    const target = resolve(root, value);
    if (!existsSync(target) || !statSync(target).isFile()) {
      fail(`${label} does not name an existing file: ${value}`);
      return;
    }
    const rel = relative(root, realpathSync(target));
    if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
      fail(`${label} must be under the session directory: ${value}`);
    }
  };

  const checkSection = (name) => {
    if (!isObject(gate[name])) {
      fail(`${name} must be an object`);
      return false;
    }
    return true;
  };

  const checkPassingRound = (name) => {
    if (!checkSection(name)) return;
    const section = gate[name];
    if (section.result !== 'PASS') fail(`${name}.result must be "PASS"`);
    if (!Number.isInteger(section.round) || section.round < 1) {
      fail(`${name}.round must be an integer of at least 1`);
    }
    checkFile(`${name}.report`, section.report);
  };

  if (gate.schema !== 1) fail('schema must be 1');

  checkFile('approvedBrief', gate.approvedBrief);

  if (checkSection('codeState')) {
    if (!isNonEmptyString(gate.codeState.baseline)) fail('codeState.baseline must be a non-empty string');
    if (!isNonEmptyString(gate.codeState.inspected)) fail('codeState.inspected must be a non-empty string');
  }

  if (checkSection('approval')) {
    if (!APPROVAL_MODES.includes(gate.approval.mode)) {
      fail(`approval.mode must be one of ${APPROVAL_MODES.join(', ')}`);
    }
    checkFile('approval.record', gate.approval.record);
  }

  checkPassingRound('requirementsValidation');
  checkPassingRound('externalReview');

  if (checkSection('resultConfirmation')) {
    const confirmation = gate.resultConfirmation;
    if (confirmation.required === true) {
      checkFile('resultConfirmation.record', confirmation.record);
    } else if (confirmation.required !== false) {
      fail('resultConfirmation.required must be true or false');
    }
  }

  if (checkSection('delivery')) {
    if (!isNonEmptyString(gate.delivery.scope)) fail('delivery.scope must be a non-empty string');
    if (!CEILINGS.includes(gate.delivery.ceiling)) {
      fail(`delivery.ceiling must be one of ${CEILINGS.join(', ')}`);
    }
  }

  if (!Array.isArray(gate.conditions) || gate.conditions.length === 0) {
    fail('conditions must be a non-empty array');
  } else {
    gate.conditions.forEach((condition, index) => {
      if (!isObject(condition)) {
        fail(`conditions[${index}] must be an object`);
        return;
      }
      if (!isNonEmptyString(condition.id)) fail(`conditions[${index}].id must be a non-empty string`);
      if (condition.state !== 'PASS') {
        fail(`conditions[${index}] (${condition.id ?? 'no id'}) state must be "PASS"`);
      }
    });
  }

  return violations;
}

function usage() {
  process.stderr.write(
    'Usage: node completion-gate.mjs verify <SESSION_DIR>\n' +
      '       node completion-gate.mjs template\n',
  );
  return 2;
}

export function main(argv) {
  const [command, ...rest] = argv;
  if (command === 'template' && rest.length === 0) {
    process.stdout.write(`${JSON.stringify(template(), null, 2)}\n`);
    return 0;
  }
  if (command === 'verify' && rest.length === 1) {
    const violations = verify(rest[0]);
    if (violations.length === 0) {
      process.stdout.write('completion gate verified\n');
      return 0;
    }
    process.stderr.write(`${violations.join('\n')}\n`);
    return 1;
  }
  return usage();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
