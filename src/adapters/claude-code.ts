import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { readJsonlLines } from "../parser/jsonl-stream.js";
import type { Block, NormalizedConversation, Turn } from "../model/ir.js";
import { redact, redactDeep } from "../utils/redact.js";
import type { Adapter, AdapterOptions } from "./types.js";

interface AnyContentBlock {
  type?: string;
  text?: string;
  thinking?: string;
  signature?: string;
  // tool_use
  id?: string;
  name?: string;
  input?: unknown;
  // tool_result
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
  // image
  source?: {
    type?: string;
    media_type?: string;
    data?: string;
  };
}

interface ClaudeMessage {
  role?: "user" | "assistant" | "system";
  content?: string | AnyContentBlock[];
  model?: string;
}

interface ClaudeLine {
  type?: string;
  uuid?: string;
  parentUuid?: string | null;
  timestamp?: string;
  isSidechain?: boolean;
  isMeta?: boolean;
  cwd?: string;
  sessionId?: string;
  gitBranch?: string;
  message?: ClaudeMessage;
  aiTitle?: string;
  permissionMode?: string;
  attachment?: { type?: string; content?: unknown };
  agentId?: string;
}

export const claudeCodeAdapter: Adapter = {
  id: "claude-code",
  async detect(filePath: string): Promise<boolean> {
    try {
      for await (const line of readJsonlLines<ClaudeLine>(filePath)) {
        if (line.value === null) continue;
        const v = line.value;
        if (v.sessionId && (v.type === "user" || v.type === "assistant")) {
          return true;
        }
        if (
          v.type === "permission-mode" ||
          v.type === "ai-title" ||
          v.type === "attachment"
        ) {
          return true;
        }
        // If we read 5 lines without a hit, give up.
        if (line.lineNumber >= 5) return false;
      }
    } catch {
      return false;
    }
    return false;
  },
  load(filePath, opts = {}): Promise<NormalizedConversation> {
    return loadClaudeCode(filePath, opts);
  },
};

async function loadClaudeCode(
  filePath: string,
  opts: AdapterOptions,
): Promise<NormalizedConversation> {
  const includeSubagents = opts.includeSubagents ?? true;
  const includeThinking = opts.includeThinking ?? true;
  const doRedact = opts.redact ?? false;

  const sessionId = basename(filePath, ".jsonl");
  const projectDir = dirname(filePath);
  const subagentsDir = join(projectDir, sessionId, "subagents");

  const turns: Turn[] = [];
  let cwd: string | undefined;
  let gitBranch: string | undefined;
  let model: string | undefined;
  let aiTitle: string | undefined;
  let firstUserText: string | undefined;
  let startedAt: string | undefined;
  let endedAt: string | undefined;

  const subagentBlocksByCallId = new Map<string, Block>();

  // Pre-resolve subagents (filesystem-based linkage). Match by description in
  // meta.json against tool_use input.description. If we can't match, queue
  // them for an appendix-style trailing turn.
  const unmatchedSubagents: Block[] = [];
  if (includeSubagents && existsSync(subagentsDir)) {
    const subagentEntries = await readdir(subagentsDir).catch(() => [] as string[]);
    const jsonls = subagentEntries.filter((f) => f.endsWith(".jsonl"));
    for (const f of jsonls) {
      const subFile = join(subagentsDir, f);
      const metaFile = join(subagentsDir, basename(f, ".jsonl") + ".meta.json");
      let agentType: string | undefined;
      let description: string | undefined;
      if (existsSync(metaFile)) {
        try {
          const meta = JSON.parse(readFileSync(metaFile, "utf8")) as {
            agentType?: string;
            description?: string;
          };
          agentType = meta.agentType;
          description = meta.description;
        } catch {
          // ignore
        }
      }
      const subConv = await loadClaudeCode(subFile, opts);
      if (!subConv.title && description) subConv.title = description;
      const block: Block = {
        kind: "subagent",
        conversation: subConv,
        agentType,
        description,
      };
      // Best-effort match key: description (truncated)
      if (description) {
        subagentBlocksByCallId.set(`desc:${description}`, block);
      }
      unmatchedSubagents.push(block);
    }
  }

  // Walk lines and build turns. We do NOT try to reconstruct the parentUuid
  // tree — Claude Code already writes lines in chronological/reply order, so
  // appending in order produces the correct narrative.
  for await (const line of readJsonlLines<ClaudeLine>(filePath)) {
    if (line.value === null) continue;
    const v = line.value;

    if (!cwd && v.cwd) cwd = v.cwd;
    if (!gitBranch && v.gitBranch) gitBranch = v.gitBranch;
    if (v.timestamp) {
      if (!startedAt) startedAt = v.timestamp;
      endedAt = v.timestamp;
    }

    if (v.type === "ai-title" && typeof v.aiTitle === "string") {
      aiTitle = v.aiTitle;
      continue;
    }
    if (v.type === "permission-mode" && v.permissionMode) {
      turns.push({
        role: "system",
        blocks: [{ kind: "marker", label: "permission-mode", detail: v.permissionMode }],
        timestamp: v.timestamp,
      });
      continue;
    }
    if (v.type === "attachment" && v.attachment) {
      const a = v.attachment;
      const content = a.content;
      const text =
        typeof content === "string"
          ? content
          : content
            ? JSON.stringify(content, null, 2)
            : "";
      turns.push({
        role: "system",
        blocks: [
          {
            kind: "marker",
            label: `attachment:${a.type ?? "unknown"}`,
            detail: text.length > 200 ? text.slice(0, 200) + "…" : text,
          },
        ],
        timestamp: v.timestamp,
      });
      continue;
    }

    const msg = v.message;
    if (!msg) continue;

    if (msg.role === "assistant") {
      if (!model && msg.model) model = msg.model;
      const blocks: Block[] = [];
      if (Array.isArray(msg.content)) {
        for (const cb of msg.content) {
          if (cb.type === "text" && typeof cb.text === "string") {
            const text = doRedact ? redact(cb.text) : cb.text;
            if (text.trim()) blocks.push({ kind: "text", text });
          } else if (cb.type === "thinking" && typeof cb.thinking === "string") {
            if (includeThinking) {
              const text = doRedact ? redact(cb.thinking) : cb.thinking;
              if (text.trim()) blocks.push({ kind: "reasoning", text });
            }
          } else if (cb.type === "tool_use") {
            const id = cb.id ?? "";
            const name = cb.name ?? "tool";
            const input = doRedact ? redactDeep(cb.input) : cb.input;
            blocks.push({ kind: "toolCall", id, name, input });
            // Inline subagent if this is a Task/Agent call
            if (
              includeSubagents &&
              (name === "Task" || name === "Agent") &&
              input &&
              typeof input === "object"
            ) {
              const desc = (input as { description?: string }).description;
              if (desc) {
                const sub = subagentBlocksByCallId.get(`desc:${desc}`);
                if (sub) {
                  blocks.push(sub);
                  // mark as matched so we don't append later
                  const idx = unmatchedSubagents.indexOf(sub);
                  if (idx >= 0) unmatchedSubagents.splice(idx, 1);
                }
              }
            }
          } else if (cb.type === "image" && cb.source?.data) {
            blocks.push({
              kind: "attachment",
              mime: cb.source.media_type ?? "image/png",
              data: cb.source.data,
            });
          }
        }
      } else if (typeof msg.content === "string" && msg.content.trim()) {
        const text = doRedact ? redact(msg.content) : msg.content;
        blocks.push({ kind: "text", text });
      }
      if (blocks.length > 0) {
        turns.push({ role: "assistant", blocks, timestamp: v.timestamp, uuid: v.uuid });
      }
      continue;
    }

    if (msg.role === "user") {
      const blocks: Block[] = [];
      let isToolResult = false;
      if (Array.isArray(msg.content)) {
        for (const cb of msg.content) {
          if (cb.type === "tool_result") {
            isToolResult = true;
            const out = stringifyToolResult(cb.content);
            blocks.push({
              kind: "toolResult",
              toolCallId: cb.tool_use_id ?? "",
              output: doRedact ? redact(out) : out,
              isError: cb.is_error === true,
            });
          } else if (cb.type === "text" && typeof cb.text === "string") {
            if (cb.text.trim()) {
              const text = doRedact ? redact(cb.text) : cb.text;
              blocks.push({ kind: "text", text });
              if (!firstUserText && !v.isSidechain) firstUserText = text;
            }
          } else if (cb.type === "image" && cb.source?.data) {
            blocks.push({
              kind: "attachment",
              mime: cb.source.media_type ?? "image/png",
              data: cb.source.data,
            });
          }
        }
      } else if (typeof msg.content === "string" && msg.content.trim()) {
        const text = doRedact ? redact(msg.content) : msg.content;
        blocks.push({ kind: "text", text });
        if (!firstUserText && !v.isSidechain) firstUserText = text;
      }
      if (blocks.length > 0) {
        turns.push({
          role: isToolResult ? "system" : "user",
          blocks,
          timestamp: v.timestamp,
          uuid: v.uuid,
        });
      }
      continue;
    }
  }

  // Append any unmatched sub-agents as a trailing system turn so they aren't
  // silently dropped.
  if (unmatchedSubagents.length > 0) {
    turns.push({
      role: "system",
      blocks: unmatchedSubagents,
    });
  }

  const title =
    aiTitle ?? (firstUserText ? truncate(firstUserText, 100) : sessionId);

  return {
    id: sessionId,
    title,
    agent: "claude-code",
    cwd,
    gitBranch,
    model,
    startedAt,
    endedAt,
    turns,
  };
}

function stringifyToolResult(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (c && typeof c === "object" && (c as { type?: string }).type === "text") {
          return (c as { text?: string }).text ?? "";
        }
        if (typeof c === "string") return c;
        return JSON.stringify(c);
      })
      .join("\n");
  }
  if (content === null || content === undefined) return "";
  return JSON.stringify(content, null, 2);
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
