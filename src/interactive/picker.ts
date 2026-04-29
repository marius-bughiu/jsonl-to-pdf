import { cancel, intro, isCancel, outro, select, confirm } from "@clack/prompts";
import { existsSync } from "node:fs";
import pc from "picocolors";
import { listSessions, type SessionSummary } from "../discovery/sessions.js";
import { ExitCode } from "../utils/exit.js";

export interface PickResult {
  session: SessionSummary;
  includeSubagents: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function pickerMaxItems(): number {
  // @clack/prompts windows the select list when maxItems < options.length.
  // Reserve ~7 rows for intro/header/padding/next-prompt; floor at 5 (clack's
  // minimum).
  const rows = process.stdout.rows ?? 24;
  return Math.max(5, rows - 7);
}

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toISOString().slice(0, 10);
}

export async function pickSession(): Promise<PickResult> {
  intro(pc.bold(pc.cyan("jsonl-to-pdf")) + pc.dim(" — pick a session"));

  const sessions = await listSessions({ withTitles: true });
  if (sessions.length === 0) {
    cancel("No Claude Code sessions found at ~/.claude/projects/.");
    process.exit(ExitCode.FileNotFound);
  }

  // Group by project
  const byProject = new Map<string, SessionSummary[]>();
  for (const s of sessions) {
    const list = byProject.get(s.projectPath) ?? [];
    list.push(s);
    byProject.set(s.projectPath, list);
  }

  const projectChoices = [...byProject.entries()]
    .sort((a, b) => {
      const aLatest = Math.max(...a[1].map((s) => s.modifiedAt.getTime()));
      const bLatest = Math.max(...b[1].map((s) => s.modifiedAt.getTime()));
      return bLatest - aLatest;
    })
    .map(([path, ss]) => ({
      label: pc.cyan(displayPath(path)) + pc.dim(`  (${ss.length})`),
      value: path,
    }));

  const project = await select({
    message: "Project",
    options: projectChoices,
    maxItems: pickerMaxItems(),
  });
  if (isCancel(project)) {
    cancel("Cancelled.");
    process.exit(ExitCode.Sigint);
  }

  const projSessions = byProject.get(project as string)!;
  const sessionChoice = await select({
    message: "Session",
    options: projSessions.map((s) => ({
      label:
        (s.title ? pc.bold(s.title) : pc.dim(s.sessionId.slice(0, 8))) +
        pc.dim(`  · ${formatRelative(s.modifiedAt)} · ${formatSize(s.sizeBytes)}`),
      value: s.sessionId,
    })),
    maxItems: pickerMaxItems(),
  });
  if (isCancel(sessionChoice)) {
    cancel("Cancelled.");
    process.exit(ExitCode.Sigint);
  }
  const session = projSessions.find((s) => s.sessionId === sessionChoice)!;

  const sub = await confirm({
    message: "Include sub-agent conversations?",
    initialValue: true,
  });
  if (isCancel(sub)) {
    cancel("Cancelled.");
    process.exit(ExitCode.Sigint);
  }

  outro(pc.green("✓ ") + "preparing PDF…");
  return { session, includeSubagents: sub === true };
}

function displayPath(p: string): string {
  if (!existsSync(p)) return p + pc.dim(" (missing)");
  return p;
}
