import readline from "node:readline";

const args = process.argv.slice(2);
const valueFor = (name) => args[args.indexOf(name) + 1];
const provider = valueFor("--provider");
const model = valueFor("--model");
if (!provider || !model) process.exit(1);

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
          provider,
          id: model,
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
