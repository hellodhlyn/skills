import { Type } from "typebox";
import { Value } from "typebox/value";

const text = Type.String({ minLength: 1 });
const strings = Type.Array(text);
const object = (properties) => Type.Object(properties, { additionalProperties: false });
const choice = (...values) => Type.Union(values.map((value) => Type.Literal(value)));
const condition = object({ id: text, description: text });
const finding = object({ id: text, file: text, conditionIds: strings, description: text, evidence: text, suggestion: text });

export const schemas = {
  plan: object({
    summary: text, steps: Type.Array(text, { minItems: 1 }),
    files: Type.Array(text, { minItems: 1 }),
    conditions: Type.Array(condition, { minItems: 1 }),
    checks: Type.Array(object({ id: text, argv: Type.Array(text, { minItems: 1 }) }), { minItems: 1 }),
    ui: Type.Boolean(), visualEvidence: strings, questions: strings,
  }),
  implement: object({ summary: text, blockers: strings }),
  review: object({
    summary: text,
    conditions: Type.Array(object({ id: text, status: choice("PASS", "FAIL", "UNVERIFIED"), evidence: text }), { minItems: 1 }),
    findings: Type.Array(finding),
  }),
  triage: object({ decisions: Type.Array(object({ id: text, decision: choice("accept", "reject", "uncertain"), reason: text })) }),
  recheck: object({
    findings: Type.Array(object({ id: text, status: choice("RESOLVED", "NOT_RESOLVED", "INCONCLUSIVE"), evidence: text })),
    conditions: Type.Array(object({ id: text, status: choice("PASS", "FAIL", "UNVERIFIED"), evidence: text }), { minItems: 1 }),
  }),
  design: object({ guidance: text }),
};

export function assertCoverage(items, expected) {
  const ids = items.map(({ id }) => id);
  if (new Set(ids).size !== ids.length || ids.length !== expected.length || expected.some((id) => !ids.includes(id))) throw new Error(`Result must cover exactly these IDs: ${expected.join(", ")}`);
}
export function assertResult(kind, result, expectedIds = []) {
  const schema = schemas[kind];
  if (!schema || !Value.Check(schema, result)) {
    throw new Error(`Invalid ${kind} result: ${JSON.stringify([...Value.Errors(schema, result)]).slice(0, 2500)}`);
  }
  const exactIds = assertCoverage;
  if (kind === "plan") {
    for (const items of [result.conditions, result.checks]) exactIds(items, [...new Set(items.map(({ id }) => id))]);
    if (new Set(result.files).size !== result.files.length) throw new Error("Plan files must be unique.");
    if (result.ui && !result.visualEvidence.length && !result.questions.length) {
      throw new Error("UI plans require screenshot/evidence paths produced by validation, or an explicit unresolved question.");
    }
  }
  if (kind === "review") {
    exactIds(result.conditions, expectedIds);
    exactIds(result.findings, [...new Set(result.findings.map(({ id }) => id))]);
    if (result.findings.some((finding) => finding.conditionIds.some((id) => !expectedIds.includes(id)))) throw new Error("Finding references an unknown completion condition.");
    if (result.conditions.some((condition) => condition.status !== "PASS" && !result.findings.some((finding) => finding.conditionIds.includes(condition.id)))) throw new Error("Every FAIL/UNVERIFIED condition requires an actionable finding referencing its ID.");
  }
  if (kind === "triage") exactIds(result.decisions, expectedIds);
  if (kind === "recheck") exactIds(result.findings, expectedIds);
  return result;
}
