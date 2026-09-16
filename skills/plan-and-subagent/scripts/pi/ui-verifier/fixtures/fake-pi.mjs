import readline from "node:readline";

const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  const request = JSON.parse(line);
  if (request.type === "get_state") {
    process.stdout.write(`${JSON.stringify({
      type: "response",
      id: request.id,
      command: "get_state",
      success: true,
      data: {
        model: {
          provider: process.env.PI_UI_VERIFIER_PROVIDER || "opencode-go",
          id: process.env.PI_UI_VERIFIER_MODEL || "glm-5.3-flash",
          input: ["text", "image"],
        },
      },
    })}\n`);
  }
  if (request.type === "prompt") {
    process.stdout.write(`${JSON.stringify({
      type: "response",
      id: request.id,
      command: "prompt",
      success: true,
    })}\n`);
    process.stdout.write(`${JSON.stringify({ type: "agent_settled" })}\n`);
  }
  if (request.type === "abort") {
    process.stdout.write(`${JSON.stringify({
      type: "response",
      id: request.id,
      command: "abort",
      success: true,
    })}\n`);
  }
}
