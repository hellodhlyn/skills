import path from "node:path";

const phases = new Set(["preview", "final", "recheck"]);

function text(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value;
}

function absolute(value, field) {
  const result = text(value, field);
  if (!path.isAbsolute(result)) throw new Error(`${field} must be an absolute path`);
  return path.normalize(result);
}

function array(value, field) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${field} must be a non-empty array`);
  return value.map((item, index) => text(item, `${field}[${index}]`));
}

function origin(value, field) {
  const parsed = new URL(text(value, field));
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(`${field} must use http or https`);
  return parsed.origin;
}

export function assertPathWithin(parent, candidate, field = "path") {
  const root = path.resolve(parent);
  const target = path.resolve(candidate);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`${field} must stay within ${root}`);
  return target;
}

export function assertAllowedPageUrl(allowedOrigins, value) {
  const target = new URL(value);
  if (!allowedOrigins.includes(target.origin)) throw new Error(`top-level navigation left allowed origins: ${target.origin}`);
  return target.href;
}

export function validateRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("request must be an object");
  const phase = text(input.phase, "phase");
  if (!phases.has(phase)) throw new Error(`phase must be one of: ${[...phases].join(", ")}`);
  const allowedOrigins = array(input.allowedOrigins, "allowedOrigins").map(origin);
  const url = new URL(text(input.url, "url"));
  if (!allowedOrigins.includes(url.origin)) throw new Error("url origin must be listed in allowedOrigins");
  if (!Array.isArray(input.conditions) || input.conditions.length === 0) throw new Error("conditions must be a non-empty array");
  const conditions = input.conditions.map((condition, index) => ({
    id: text(condition?.id, `conditions[${index}].id`),
    expected: text(condition?.expected, `conditions[${index}].expected`),
  }));
  if (new Set(conditions.map((condition) => condition.id)).size !== conditions.length) throw new Error("condition ids must be unique");
  if (!Array.isArray(input.viewports) || input.viewports.length === 0) throw new Error("viewports must be a non-empty array");
  const viewports = input.viewports.map((viewport, index) => {
    const width = Number(viewport?.width);
    const height = Number(viewport?.height);
    if (!Number.isInteger(width) || width < 240 || width > 3840) throw new Error(`viewports[${index}].width must be an integer from 240 to 3840`);
    if (!Number.isInteger(height) || height < 240 || height > 3840) throw new Error(`viewports[${index}].height must be an integer from 240 to 3840`);
    return { name: text(viewport?.name, `viewports[${index}].name`), width, height };
  });
  if (new Set(viewports.map((viewport) => viewport.name)).size !== viewports.length) throw new Error("viewport names must be unique");
  return {
    phase,
    workdir: absolute(input.workdir, "workdir"),
    artifactDir: absolute(input.artifactDir, "artifactDir"),
    codeState: text(input.codeState, "codeState"),
    url: url.href,
    allowedOrigins,
    conditions,
    viewports,
    stateChangesAuthorized: input.stateChangesAuthorized === true,
    storageStatePath: input.storageStatePath === undefined ? undefined : absolute(input.storageStatePath, "storageStatePath"),
  };
}
