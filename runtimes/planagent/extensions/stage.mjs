import { readFileSync, unlinkSync, realpathSync, existsSync, lstatSync } from "node:fs";
import path from "node:path";
import { Type } from "typebox";
import { schemas, assertResult } from "../src/contracts.mjs";
import { safePath } from "../src/repository.mjs";

export default function stageExtension(pi) {
  const request = JSON.parse(readFileSync(process.env.PLANAGENT_STAGE_REQUEST, "utf8"));
  let submitted = false;
  const writable = new Set(request.writable);
  const tools = ["read", "grep", "find", "ls", "submit_result"];
  if (writable.size) tools.push("write", "edit", "remove_file");
  pi.on("session_start", () => pi.setActiveTools(tools));
  pi.on("tool_call", (event) => {
    try {
      if (submitted) throw new Error("Result already submitted; finish your response without more tools.");
      if (!tools.includes(event.toolName)) throw new Error("Tool is not allowed in this stage.");
      if (event.toolName === "submit_result") return;
      const target = event.input.path || ".";
      const absolute = path.resolve(request.project, target);
      const relative = path.relative(request.project, absolute);
      const evidence = request.evidencePaths.includes(absolute);
      if (relative !== "" && !(event.toolName === "read" && evidence)) safePath(request.project, relative);
      if (["write", "edit", "remove_file"].includes(event.toolName)) {
        if (!writable.has(relative)) throw new Error(`File is outside approved ownership: ${relative}`);
        if (existsSync(absolute) && realpathSync(absolute) !== absolute) throw new Error("Writing through symlinks is not allowed.");
        if (existsSync(absolute) && lstatSync(absolute).nlink > 1) throw new Error("Writing multiply-linked files is not allowed.");
      }
    } catch (error) { return { block: true, reason: error.message }; }
  });
  pi.registerTool({
    name: "submit_result", label: "Submit stage result",
    description: "Submit the structured result after all work and inspection. Do not call any tools afterward.",
    parameters: schemas[request.kind],
    async execute(_id, result) {
      if (submitted) throw new Error("Result already submitted.");
      assertResult(request.kind, result, request.expectedIds);
      submitted = true;
      return { content: [{ type: "text", text: "Result accepted. Finish now." }], details: { planagentResult: result } };
    },
  });
  pi.registerTool({
    name: "remove_file", label: "Remove approved file",
    description: "Delete an explicitly approved task-owned file.",
    parameters: Type.Object({ path: Type.String() }, { additionalProperties: false }),
    async execute(_id, { path: filename }) {
      const relative = path.relative(request.project, path.resolve(request.project, filename));
      if (!writable.has(relative)) throw new Error("File is outside approved ownership.");
      unlinkSync(safePath(request.project, relative));
      return { content: [{ type: "text", text: `Removed ${relative}` }] };
    },
  });
}
