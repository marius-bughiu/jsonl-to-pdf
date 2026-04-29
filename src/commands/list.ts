import { defineCommand } from "citty";
import pc from "picocolors";
import { listSessions } from "../discovery/sessions.js";

export const listCommand = defineCommand({
  meta: {
    name: "list",
    description: "List Claude Code sessions discovered on this machine.",
  },
  args: {
    json: {
      type: "boolean",
      description: "Output JSON instead of a table.",
    },
    titles: {
      type: "boolean",
      description: "Read each file to derive a title (slower).",
    },
  },
  async run({ args }) {
    const sessions = await listSessions({ withTitles: args.titles === true });
    if (args.json) {
      process.stdout.write(
        JSON.stringify(
          sessions.map((s) => ({
            sessionId: s.sessionId,
            projectPath: s.projectPath,
            filePath: s.filePath,
            sizeBytes: s.sizeBytes,
            modifiedAt: s.modifiedAt.toISOString(),
            title: s.title,
          })),
          null,
          2,
        ) + "\n",
      );
      return;
    }
    if (sessions.length === 0) {
      process.stderr.write("No sessions found.\n");
      return;
    }
    let lastProject: string | null = null;
    for (const s of sessions) {
      if (s.projectPath !== lastProject) {
        process.stdout.write(`\n${pc.cyan(pc.bold(s.projectPath))}\n`);
        lastProject = s.projectPath;
      }
      const size =
        s.sizeBytes < 1024 * 1024
          ? `${(s.sizeBytes / 1024).toFixed(0)}KB`
          : `${(s.sizeBytes / 1024 / 1024).toFixed(1)}MB`;
      const date = s.modifiedAt.toISOString().slice(0, 16).replace("T", " ");
      const title = s.title ?? pc.dim(s.sessionId.slice(0, 8));
      process.stdout.write(
        `  ${pc.dim(date)}  ${pc.dim(size.padStart(6))}  ${title}\n`,
      );
    }
  },
});
