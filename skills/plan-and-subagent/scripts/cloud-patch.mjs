import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function roundId(value) {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(value || "")) throw new Error("Invalid round ID");
  return value;
}

export function framePatch(round, patch) {
  roundId(round);
  const compressed = gzipSync(patch);
  const encoded = compressed.toString("base64");
  const chunks = encoded.match(/.{1,1200}/g);
  const prefix = `CLOUD_PATCH ${round}`;
  const frames = chunks.map((chunk, index) => `${prefix} CHUNK ${index + 1} ${chunk}`);
  frames.push(`${prefix} META ${JSON.stringify({ chunks: chunks.length, bytes: patch.length,
    sha256: hash(patch), gzipSha256: hash(compressed) })}`);
  return frames.join("\n") + "\n";
}

function toolOutput(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
}

export function recoverPatch(round, transcript) {
  roundId(round);
  const prefix = `CLOUD_PATCH ${round} `;
  const chunks = new Map();
  let meta;
  // CLI transcript placeholders are not completed Cloud tool results.
  for (const line of transcript.split("\n").filter((line) => line.trim())) {
    const record = JSON.parse(line);
    if (record.remoteSourced !== true || record.type !== "user" || !Array.isArray(record.message?.content)) continue;
    for (const block of record.message.content) {
      if (block.type !== "tool_result" || block.is_error) continue;
      for (const outputLine of toolOutput(block.content).split("\n")) {
        if (!outputLine.startsWith(prefix)) continue;
        const frame = outputLine.slice(prefix.length);
        if (frame.startsWith("META ")) {
          const value = JSON.parse(frame.slice(5));
          if (meta && JSON.stringify(meta) !== JSON.stringify(value)) throw new Error("Conflicting metadata");
          meta = value;
        } else {
          const match = /^CHUNK ([1-9][0-9]*) ([A-Za-z0-9+/]+={0,2})$/.exec(frame);
          if (!match || match[2].length > 1200) throw new Error("Invalid chunk frame");
          const index = Number(match[1]);
          if (chunks.has(index) && chunks.get(index) !== match[2]) throw new Error("Conflicting chunk");
          chunks.set(index, match[2]);
        }
      }
    }
  }
  if (!meta || !Number.isSafeInteger(meta.chunks) || meta.chunks < 1
    || !Number.isSafeInteger(meta.bytes) || meta.bytes < 0
    || !/^[a-f0-9]{64}$/.test(meta.sha256) || !/^[a-f0-9]{64}$/.test(meta.gzipSha256)) {
    throw new Error("Missing or invalid patch metadata");
  }
  if (chunks.size !== meta.chunks) throw new Error("Missing or extra patch chunks");
  const ordered = [];
  for (let index = 1; index <= meta.chunks; index++) {
    if (!chunks.has(index)) throw new Error("Missing patch chunk");
    ordered.push(chunks.get(index));
  }
  const encoded = ordered.join("");
  const compressed = Buffer.from(encoded, "base64");
  if (compressed.toString("base64") !== encoded || hash(compressed) !== meta.gzipSha256) {
    throw new Error("Compressed patch hash mismatch");
  }
  const patch = gunzipSync(compressed);
  if (patch.length !== meta.bytes || hash(patch) !== meta.sha256) throw new Error("Patch hash mismatch");
  return { patch, metadata: meta };
}

export function exportPatch(round, base, paths, cwd = process.cwd()) {
  roundId(round);
  if (!/^[a-f0-9]{40,64}$/.test(base || "")) throw new Error("Supply the pinned full Cloud base hash");
  if (!paths.length) throw new Error("Explicit result paths are required");
  for (const file of paths) {
    const segments = file.split(/[\\/]/);
    if (path.isAbsolute(file) || segments.some((part) => !part || [".", "..", ".git", ".cloud-inputs"].includes(part))) {
      throw new Error(`Unsafe result path: ${file}`);
    }
  }
  const git = (args) => execFileSync("git", ["--literal-pathspecs", ...args], {
    cwd, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 128 * 1024 * 1024,
  });
  git(["rev-parse", "--verify", `${base}^{commit}`]);
  // Reject directory paths so a broad path cannot accidentally include inputs.
  for (const file of paths) {
    if (fs.existsSync(path.join(cwd, file)) && fs.lstatSync(path.join(cwd, file)).isDirectory()) {
      throw new Error(`Result paths must name files: ${file}`);
    }
  }
  git(["add", "-A", "--", ...paths]);
  const patch = git(["diff", "--cached", "--binary", base, "--", ...paths]);
  return framePatch(round, patch);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [command, round, first, ...rest] = process.argv.slice(2);
    if (command === "export") process.stdout.write(exportPatch(round, first, rest));
    else if (command === "recover" && rest.length === 1) {
      const result = recoverPatch(round, fs.readFileSync(first, "utf8"));
      fs.writeFileSync(rest[0], result.patch, { flag: "wx" });
      process.stdout.write(JSON.stringify(result.metadata) + "\n");
    } else throw new Error("Usage: cloud-patch.mjs export ROUND BASE FILE... | recover ROUND TRANSCRIPT OUTPUT");
  } catch (error) {
    process.stderr.write(error.message + "\n");
    process.exitCode = 1;
  }
}
