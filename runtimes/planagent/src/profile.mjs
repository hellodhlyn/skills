import { readFileSync } from "node:fs";

const roles = ["planner", "implementer", "repair", "internal-reviewer", "triager", "reviewer", "ui-ux"];
const thinkingLevels = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);

export function readProfile(filename) {
  const profile = JSON.parse(readFileSync(filename || new URL("../profiles/default.json", import.meta.url), "utf8"));
  for (const name of ["maxCalls", "maxRepairs", "maxInternalReviews", "maxExternalReviews", "stageTimeoutMs", "validationTimeoutMs"]) {
    if (!Number.isSafeInteger(profile.limits?.[name]) || profile.limits[name] <= 0) throw new Error(`Profile requires a positive integer limit: ${name}`);
  }
  for (const role of roles) {
    const config = profile.roles?.[role];
    if (!config || ![config.provider, config.model].every((value) => typeof value === "string" && value.trim() === value && value.length > 0)) {
      throw new Error(`The ${role} role requires an explicit provider and model in profiles/default.json.`);
    }
    if (!thinkingLevels.has(config.thinking)) {
      throw new Error(`The ${role} role has an invalid thinking level in profiles/default.json.`);
    }
  }
  return profile;
}
