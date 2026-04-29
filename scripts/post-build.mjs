import { chmodSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const cliPath = join(process.cwd(), "dist", "cli.js");
if (!existsSync(cliPath)) {
  process.exit(0);
}
const content = readFileSync(cliPath, "utf8");
if (!content.startsWith("#!")) {
  writeFileSync(cliPath, "#!/usr/bin/env node\n" + content);
}
try {
  chmodSync(cliPath, 0o755);
} catch {
  // Windows; ignore.
}
