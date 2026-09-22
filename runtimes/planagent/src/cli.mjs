import { readFileSync } from "node:fs";

const help = `Planagent — Pi workflow runtime

Usage:
  planagent [--help | --version]
  plana     [--help | --version]

Commands:
  -h, --help       Show this help
  -v, --version    Show the package version

planagent and plana are equivalent commands.
This initial scaffold does not execute workflows yet.
Planning, implementation, validation, review, and resume are not available.
`;

export function runCli(args) {
  if (args.length === 0 || (args.length === 1 && ["-h", "--help"].includes(args[0]))) {
    process.stdout.write(help);
    return 0;
  }

  if (args.length === 1 && ["-v", "--version"].includes(args[0])) {
    const metadata = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    process.stdout.write(`planagent ${metadata.version}\n`);
    return 0;
  }

  process.stderr.write("Unsupported command or arguments. Workflow execution is not implemented yet.\nRun plana --help for available options.\n");
  return 2;
}
