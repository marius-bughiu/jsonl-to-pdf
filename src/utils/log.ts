import pc from "picocolors";

export const log = {
  info(msg: string) {
    process.stderr.write(`${pc.cyan("•")} ${msg}\n`);
  },
  success(msg: string) {
    process.stderr.write(`${pc.green("✓")} ${msg}\n`);
  },
  warn(msg: string) {
    process.stderr.write(`${pc.yellow("!")} ${msg}\n`);
  },
  error(msg: string) {
    process.stderr.write(`${pc.red("✗")} ${msg}\n`);
  },
  dim(msg: string) {
    process.stderr.write(`${pc.dim(msg)}\n`);
  },
};
