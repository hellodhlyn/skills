import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
function check(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, item.name);
    if (item.isDirectory()) check(filename);
    else if (item.name.endsWith(".mjs")) execFileSync(process.execPath, ["--check", filename], { stdio: "inherit" });
  }
}
for (const folder of ["bin", "src", "extensions", "scripts", "test"]) check(path.join(root, folder));
execFileSync(process.execPath, [path.join(root, "bin/planagent.mjs"), "models"], { stdio: "inherit" });
