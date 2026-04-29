#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { convertCommand } from "./commands/convert.js";
import { listCommand } from "./commands/list.js";
import { ExitCode } from "./utils/exit.js";
import { log } from "./utils/log.js";

// If the first positional argument doesn't name a known subcommand, default
// to `convert` so `jsonl-to-pdf <file>` and `jsonl-to-pdf` (no args) both work
// without colliding with citty's subcommand routing.
const KNOWN = new Set(["convert", "list", "--help", "-h", "--version", "-v"]);
const argv = process.argv.slice(2);
if (argv.length === 0 || !KNOWN.has(argv[0])) {
  process.argv.splice(2, 0, "convert");
}

const main = defineCommand({
  meta: {
    name: "jsonl-to-pdf",
    version: "0.1.10",
    description:
      "Turn AI coding-agent sessions (Claude Code today, more soon) into shareable PDFs.",
  },
  subCommands: {
    convert: convertCommand,
    list: listCommand,
  },
});

process.on("SIGINT", () => {
  process.stderr.write("\nInterrupted.\n");
  process.exit(ExitCode.Sigint);
});

runMain(main).catch((err: unknown) => {
  if (err instanceof Error) {
    log.error(err.message);
    if (process.env.DEBUG) process.stderr.write(`${err.stack}\n`);
  } else {
    log.error(String(err));
  }
  process.exit(ExitCode.Generic);
});
