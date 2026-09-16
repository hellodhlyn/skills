import { realpathSync, statSync } from "node:fs";
import path from "node:path";

const PHASES = new Set(["preview", "final", "recheck"]);
const STATES = new Set(["PASS", "FAIL", "UNVERIFIED", "DECISION_REQUIRED"]);

function requiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function absolutePath(value, field) {
  const result = requiredString(value, field);
  if (!path.isAbsolute(result)) {
    throw new Error(`${field} must be an absolute path`);
  }
  return path.normalize(result);
}

function stringArray(value, field, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${field} must be ${allowEmpty ? "an" : "a non-empty"} array`);
  }
  return value.map((item, index) => requiredString(item, `${field}[${index}]`));
}

function validateOrigin(value, field) {
  const origin = new URL(requiredString(value, field)).origin;
  if (origin === "null") {
    throw new Error(`${field} must be an http or https origin`);
  }
  const protocol = new URL(origin).protocol;
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error(`${field} must use http or https`);
  }
  return origin;
}

function validateCondition(value, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`conditions[${index}] must be an object`);
  }
  return {
    id: requiredString(value.id, `conditions[${index}].id`),
    expected: requiredString(value.expected, `conditions[${index}].expected`),
    scenarios: stringArray(value.scenarios, `conditions[${index}].scenarios`),
  };
}

function validateViewport(value, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`viewports[${index}] must be an object`);
  }
  const width = Number(value.width);
  const height = Number(value.height);
  if (!Number.isInteger(width) || width < 240 || width > 3840) {
    throw new Error(`viewports[${index}].width must be an integer from 240 to 3840`);
  }
  if (!Number.isInteger(height) || height < 240 || height > 3840) {
    throw new Error(`viewports[${index}].height must be an integer from 240 to 3840`);
  }
  return {
    name: requiredString(value.name, `viewports[${index}].name`),
    width,
    height,
  };
}

function evidenceArray(value, field, artifactDir, { allowEmpty = false } = {}) {
  const evidence = stringArray(value, field, { allowEmpty });
  return evidence.map((item, index) => {
    const evidencePath = assertPathWithin(
      artifactDir,
      absolutePath(item, `${field}[${index}]`),
      `${field}[${index}]`,
    );
    let evidenceStat;
    try {
      evidenceStat = statSync(evidencePath);
    } catch {
      throw new Error(`${field}[${index}] does not exist: ${evidencePath}`);
    }
    if (!evidenceStat.isFile()) {
      throw new Error(`${field}[${index}] must reference a file: ${evidencePath}`);
    }
    return evidencePath;
  });
}

export function validateRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("request must be an object");
  }

  const phase = requiredString(input.phase, "phase");
  if (!PHASES.has(phase)) {
    throw new Error(`phase must be one of: ${[...PHASES].join(", ")}`);
  }

  const workdir = absolutePath(input.workdir, "workdir");
  const artifactDir = absolutePath(input.artifactDir, "artifactDir");
  const url = new URL(requiredString(input.url, "url"));
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("url must use http or https");
  }

  const allowedOrigins = stringArray(input.allowedOrigins, "allowedOrigins").map(
    (origin, index) => validateOrigin(origin, `allowedOrigins[${index}]`),
  );
  if (!allowedOrigins.includes(url.origin)) {
    throw new Error("url origin must be listed in allowedOrigins");
  }

  if (!Array.isArray(input.viewports) || input.viewports.length === 0) {
    throw new Error("viewports must be a non-empty array");
  }
  if (!Array.isArray(input.conditions) || input.conditions.length === 0) {
    throw new Error("conditions must be a non-empty array");
  }
  const viewports = input.viewports.map(validateViewport);
  const conditions = input.conditions.map(validateCondition);
  const viewportNames = viewports.map((viewport) => viewport.name);
  if (new Set(viewportNames).size !== viewportNames.length) {
    throw new Error("viewport names must be unique");
  }
  const conditionIds = conditions.map((condition) => condition.id);
  if (new Set(conditionIds).size !== conditionIds.length) {
    throw new Error("condition ids must be unique");
  }

  const acceptedFindings = input.acceptedFindings === undefined
    ? []
    : stringArray(input.acceptedFindings, "acceptedFindings", { allowEmpty: true });
  if (phase === "recheck" && acceptedFindings.length === 0) {
    throw new Error("recheck requires acceptedFindings");
  }
  if (phase !== "recheck" && acceptedFindings.length > 0) {
    throw new Error("acceptedFindings are only valid for recheck");
  }
  if (new Set(acceptedFindings).size !== acceptedFindings.length) {
    throw new Error("acceptedFindings must be unique");
  }

  const storageStatePath = input.storageStatePath === undefined
    ? undefined
    : absolutePath(input.storageStatePath, "storageStatePath");

  return {
    phase,
    workdir,
    artifactDir,
    codeState: requiredString(input.codeState, "codeState"),
    url: url.href,
    allowedOrigins,
    viewports,
    conditions,
    acceptedFindings,
    stateChangesAuthorized: input.stateChangesAuthorized === true,
    storageStatePath,
    notes: typeof input.notes === "string" ? input.notes : "",
  };
}

export function assertPathWithin(parent, candidate, field = "path") {
  const normalizedParent = path.resolve(parent);
  const normalizedCandidate = path.resolve(candidate);
  const relative = path.relative(normalizedParent, normalizedCandidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${field} must stay within ${normalizedParent}`);
  }
  return normalizedCandidate;
}

export function assertAllowedPageUrl(allowedOrigins, value) {
  const url = new URL(value);
  if (!allowedOrigins.includes(url.origin)) {
    throw new Error(`top-level navigation left allowed origins: ${url.origin}`);
  }
  return url.href;
}

export function validateReport(report, request) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    throw new Error("report must be an object");
  }
  requiredString(report.summary, "report.summary");
  if (!Array.isArray(report.conditions)) {
    throw new Error("report.conditions must be an array");
  }
  const expectedIds = new Set(request.conditions.map((condition) => condition.id));
  const statuses = new Map();
  const seen = new Set();
  for (const [index, condition] of report.conditions.entries()) {
    const id = requiredString(condition.id, `report.conditions[${index}].id`);
    if (!expectedIds.has(id)) {
      throw new Error(`report contains unknown condition: ${id}`);
    }
    if (seen.has(id)) {
      throw new Error(`report contains duplicate condition: ${id}`);
    }
    seen.add(id);
    if (!STATES.has(condition.status)) {
      throw new Error(`report.conditions[${index}].status is invalid`);
    }
    statuses.set(id, condition.status);
    requiredString(condition.observation, `report.conditions[${index}].observation`);
    evidenceArray(
      condition.evidence,
      `report.conditions[${index}].evidence`,
      request.artifactDir,
      { allowEmpty: condition.status === "UNVERIFIED" },
    );
    stringArray(
      condition.reproductionSteps,
      `report.conditions[${index}].reproductionSteps`,
      { allowEmpty: true },
    );
    if (condition.userImpact !== undefined) {
      requiredString(condition.userImpact, `report.conditions[${index}].userImpact`);
    }
    if (condition.correctionDirection !== undefined) {
      requiredString(
        condition.correctionDirection,
        `report.conditions[${index}].correctionDirection`,
      );
    }
  }
  for (const id of expectedIds) {
    if (!seen.has(id)) {
      throw new Error(`report is missing condition: ${id}`);
    }
  }
  if (!Array.isArray(report.findings)) {
    throw new Error("report.findings must be an array");
  }
  const findingIds = new Set();
  for (const [index, finding] of report.findings.entries()) {
    const findingId = requiredString(finding.id, `report.findings[${index}].id`);
    if (findingIds.has(findingId)) {
      throw new Error(`report contains duplicate finding: ${findingId}`);
    }
    findingIds.add(findingId);
    if (request.phase === "recheck" && !request.acceptedFindings.includes(findingId)) {
      throw new Error(`recheck contains an unaccepted finding: ${findingId}`);
    }
    requiredString(finding.title, `report.findings[${index}].title`);
    const conditionId = requiredString(
      finding.conditionId,
      `report.findings[${index}].conditionId`,
    );
    if (!expectedIds.has(conditionId)) {
      throw new Error(`report finding contains unknown condition: ${conditionId}`);
    }
    if (!["FAIL", "DECISION_REQUIRED"].includes(statuses.get(conditionId))) {
      throw new Error(`report finding ${findingId} must reference a failed or decision-required condition`);
    }
    requiredString(finding.trigger, `report.findings[${index}].trigger`);
    requiredString(finding.impact, `report.findings[${index}].impact`);
    evidenceArray(
      finding.evidence,
      `report.findings[${index}].evidence`,
      request.artifactDir,
    );
    requiredString(
      finding.correctionDirection,
      `report.findings[${index}].correctionDirection`,
    );
  }
  stringArray(report.limitations, "report.limitations", { allowEmpty: true });
  return report;
}

export function realWorkdir(workdir) {
  return realpathSync(workdir);
}
