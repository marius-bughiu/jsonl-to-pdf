import { readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { readJsonlLines } from "../parser/jsonl-stream.js";
import { claudeProjectsRoot, decodeProjectDir, isReadableDir } from "./paths.js";

export interface SessionSummary {
  sessionId: string;
  projectDir: string;        // encoded directory name (e.g. C--S-jsonl-to-pdf)
  projectPath: string;       // decoded absolute path
  filePath: string;          // absolute path to .jsonl
  sizeBytes: number;
  modifiedAt: Date;
  title?: string;
  firstUserMessage?: string;
}

interface ClaudeLine {
  type?: string;
  aiTitle?: string;
  message?: { role?: string; content?: unknown };
  isSidechain?: boolean;
}

const TITLE_SCAN_LIMIT = 80; // lines

async function deriveTitle(filePath: string): Promise<{
  title?: string;
  firstUserMessage?: string;
}> {
  let aiTitle: string | undefined;
  let firstUser: string | undefined;
  let scanned = 0;
  for await (const line of readJsonlLines<ClaudeLine>(filePath)) {
    if (line.value === null) continue;
    const v = line.value;
    if (v.type === "ai-title" && typeof v.aiTitle === "string" && !aiTitle) {
      aiTitle = v.aiTitle;
    }
    if (
      v.type === "user" &&
      v.message?.role === "user" &&
      !v.isSidechain &&
      !firstUser
    ) {
      const c = v.message.content;
      if (typeof c === "string" && c.trim()) {
        firstUser = c.trim();
      } else if (Array.isArray(c)) {
        for (const block of c) {
          if (
            block &&
            typeof block === "object" &&
            (block as { type?: string }).type === "text" &&
            typeof (block as { text?: string }).text === "string"
          ) {
            firstUser = (block as { text: string }).text.trim();
            break;
          }
        }
      }
    }
    if (++scanned >= TITLE_SCAN_LIMIT && (aiTitle || firstUser)) break;
    if (scanned >= TITLE_SCAN_LIMIT * 4) break;
  }
  return {
    title: aiTitle ?? (firstUser ? truncate(firstUser, 80) : undefined),
    firstUserMessage: firstUser,
  };
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

export async function listSessions(opts?: {
  root?: string;
  withTitles?: boolean;
}): Promise<SessionSummary[]> {
  const root = opts?.root ?? claudeProjectsRoot();
  if (!existsSync(root)) return [];
  const projectDirs = await readdir(root);
  const out: SessionSummary[] = [];
  for (const dir of projectDirs) {
    const projAbs = join(root, dir);
    if (!isReadableDir(projAbs)) continue;
    let entries: string[];
    try {
      entries = await readdir(projAbs);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".jsonl")) continue;
      const filePath = join(projAbs, entry);
      let s;
      try {
        s = await stat(filePath);
      } catch {
        continue;
      }
      if (!s.isFile()) continue;
      const summary: SessionSummary = {
        sessionId: basename(entry, ".jsonl"),
        projectDir: dir,
        projectPath: decodeProjectDir(dir),
        filePath,
        sizeBytes: s.size,
        modifiedAt: s.mtime,
      };
      out.push(summary);
    }
  }
  out.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
  if (opts?.withTitles) {
    await Promise.all(
      out.map(async (s) => {
        try {
          const t = await deriveTitle(s.filePath);
          s.title = t.title;
          s.firstUserMessage = t.firstUserMessage;
        } catch {
          // ignore unreadable
        }
      }),
    );
  }
  return out;
}

export { deriveTitle };
