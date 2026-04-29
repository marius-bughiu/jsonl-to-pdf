import type { Block, NormalizedConversation, Turn } from "../model/ir.js";
import {
  contentWidth,
  flowCode,
  flowProse,
  hrule,
  spacer,
  type Box,
  type Doc,
  type TextStyle,
} from "./flow.js";
import type { Theme } from "./theme.js";

export interface RenderOptions {
  compact: boolean;
  includeThinking: boolean;
  subagentMode: "inline" | "appendix" | "none";
}

const COMPACT_TOOL_LINES = 30;

function rolePill(doc: Doc, theme: Theme, role: Turn["role"]): void {
  const palette = theme.palette;
  const text =
    role === "user" ? "USER" : role === "assistant" ? "ASSISTANT" : "SYSTEM";
  const fg =
    role === "user"
      ? palette.userFg
      : role === "assistant"
        ? palette.assistantFg
        : palette.systemFg;
  doc.font("bodyBold").fontSize(theme.fontSize.small).fillColor(fg);
  const w = doc.widthOfString(text) + 12;
  const h = theme.fontSize.small + 6;
  const x = theme.page.margin;
  const y = doc.y;
  doc.save();
  doc.roundedRect(x, y, w, h, 3).fillOpacity(0.12).fill(fg).fillOpacity(1);
  doc.restore();
  doc.font("bodyBold").fontSize(theme.fontSize.small).fillColor(fg);
  doc.text(text, x + 6, y + 3, { lineBreak: false });
  doc.y = y + h + 4;
}

function turnBox(theme: Theme, indent: number): Box {
  return {
    x: theme.page.margin + indent,
    width: contentWidth(theme) - indent,
    paddingX: 10,
    paddingY: 8,
  };
}

function bareBox(theme: Theme, indent: number): Box {
  return {
    x: theme.page.margin + indent,
    width: contentWidth(theme) - indent,
    paddingX: 0,
    paddingY: 0,
  };
}

function styleFor(theme: Theme): {
  body: TextStyle;
  bodyMuted: TextStyle;
  reasoning: TextStyle;
  code: TextStyle;
  toolHeader: TextStyle;
  toolBody: TextStyle;
  toolError: TextStyle;
  marker: TextStyle;
} {
  const p = theme.palette;
  return {
    body: { font: "body", size: theme.fontSize.body, color: p.fg },
    bodyMuted: { font: "body", size: theme.fontSize.small, color: p.muted },
    reasoning: {
      font: "bodyItalic",
      size: theme.fontSize.body - 0.5,
      color: p.reasoningFg,
      bg: p.reasoningBg,
      leftRule: p.muted,
      leftRuleWidth: 2,
      textIndent: 8,
    },
    code: {
      font: "mono",
      size: theme.fontSize.mono,
      color: p.codeFg,
      bg: p.codeBg,
    },
    toolHeader: {
      font: "bodyBold",
      size: theme.fontSize.small,
      color: p.toolHeaderFg,
    },
    toolBody: {
      font: "mono",
      size: theme.fontSize.mono,
      color: p.fg,
      bg: p.toolResultBg,
    },
    toolError: {
      font: "mono",
      size: theme.fontSize.mono,
      color: p.fg,
      bg: p.errorBg,
      leftRule: p.errorBorder,
      leftRuleWidth: 2,
      textIndent: 8,
    },
    marker: {
      font: "bodyItalic",
      size: theme.fontSize.small,
      color: p.muted,
    },
  };
}

function maybeTrim(text: string, compact: boolean, lines = COMPACT_TOOL_LINES): string {
  if (!compact) return text;
  const all = text.split(/\r?\n/);
  if (all.length <= lines) return text;
  const head = all.slice(0, lines);
  return head.join("\n") + `\n… [+${all.length - lines} lines truncated, --compact]`;
}

function stringifyInput(input: unknown): string {
  if (input === null || input === undefined) return "";
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

export function renderBlocks(
  doc: Doc,
  theme: Theme,
  blocks: Block[],
  opts: RenderOptions,
  indent: number,
): void {
  const styles = styleFor(theme);
  for (const block of blocks) {
    switch (block.kind) {
      case "text": {
        flowProse(doc, theme, bareBox(theme, indent), styles.body, block.text);
        spacer(doc, theme, theme.spacing.paragraph);
        break;
      }
      case "reasoning": {
        if (!opts.includeThinking) break;
        flowProse(doc, theme, turnBox(theme, indent), styles.reasoning, block.text);
        spacer(doc, theme, theme.spacing.paragraph);
        break;
      }
      case "code": {
        flowCode(doc, theme, turnBox(theme, indent), styles.code, block.text);
        spacer(doc, theme, theme.spacing.paragraph);
        break;
      }
      case "toolCall": {
        // Header
        doc.font("bodyBold").fontSize(theme.fontSize.small).fillColor(theme.palette.toolHeaderFg);
        doc.text(`▸ ${block.name}`, theme.page.margin + indent, doc.y, { lineBreak: false });
        doc.y += theme.fontSize.small + 4;
        const inputText = stringifyInput(block.input);
        if (inputText.trim()) {
          flowCode(
            doc,
            theme,
            turnBox(theme, indent),
            { ...styles.toolBody, bg: theme.palette.toolBg },
            maybeTrim(inputText, opts.compact),
          );
        }
        spacer(doc, theme, theme.spacing.paragraph);
        break;
      }
      case "toolResult": {
        doc.font("bodyBold").fontSize(theme.fontSize.small).fillColor(theme.palette.muted);
        doc.text(block.isError ? "← result (error)" : "← result", theme.page.margin + indent, doc.y, {
          lineBreak: false,
        });
        doc.y += theme.fontSize.small + 4;
        const text = block.output || "(empty)";
        flowCode(
          doc,
          theme,
          turnBox(theme, indent),
          block.isError ? styles.toolError : styles.toolBody,
          maybeTrim(text, opts.compact),
        );
        spacer(doc, theme, theme.spacing.paragraph);
        break;
      }
      case "attachment": {
        if (block.mime.startsWith("image/")) {
          try {
            const buf =
              typeof block.data === "string"
                ? Buffer.from(block.data, "base64")
                : Buffer.from(block.data);
            const maxW = contentWidth(theme) - indent - 20;
            doc.image(buf, theme.page.margin + indent, doc.y, { fit: [maxW, 320] });
            doc.y += 330;
          } catch {
            flowProse(
              doc,
              theme,
              bareBox(theme, indent),
              styles.bodyMuted,
              `[image attachment: ${block.mime}]`,
            );
          }
        } else {
          flowProse(
            doc,
            theme,
            bareBox(theme, indent),
            styles.bodyMuted,
            `[attachment: ${block.mime}${block.name ? ` (${block.name})` : ""}]`,
          );
        }
        spacer(doc, theme, theme.spacing.paragraph);
        break;
      }
      case "marker": {
        flowProse(
          doc,
          theme,
          bareBox(theme, indent),
          styles.marker,
          `— ${block.label}${block.detail ? `: ${block.detail}` : ""}`,
        );
        spacer(doc, theme, theme.spacing.paragraph);
        break;
      }
      case "subagent": {
        if (opts.subagentMode === "none") break;
        if (opts.subagentMode === "appendix") {
          // Just leave a small reference; the appendix walker will render it.
          flowProse(
            doc,
            theme,
            bareBox(theme, indent),
            styles.bodyMuted,
            `↪ sub-agent: ${block.agentType ?? "agent"}${block.description ? ` — ${block.description}` : ""} (see appendix)`,
          );
          spacer(doc, theme, theme.spacing.paragraph);
          break;
        }
        renderSubagentInline(doc, theme, block, opts, indent);
        break;
      }
      case "custom": {
        flowProse(
          doc,
          theme,
          bareBox(theme, indent),
          styles.bodyMuted,
          `[${block.adapterId} block]`,
        );
        spacer(doc, theme, theme.spacing.paragraph);
        break;
      }
    }
  }
}

function renderSubagentInline(
  doc: Doc,
  theme: Theme,
  block: Block & { kind: "subagent" },
  opts: RenderOptions,
  indent: number,
): void {
  const p = theme.palette;
  const subIndent = indent + 14;

  // Badge header
  const badgeText = `↪ ${block.agentType ?? "sub-agent"}${block.description ? ` — ${block.description}` : ""}`;
  doc.font("bodyBold").fontSize(theme.fontSize.small).fillColor(p.subagentBadgeFg);
  const x = theme.page.margin + subIndent;
  const y = doc.y;
  const w = Math.min(doc.widthOfString(badgeText) + 12, contentWidth(theme) - subIndent);
  const h = theme.fontSize.small + 6;
  doc.save();
  doc.rect(x, y, w, h).fill(p.subagentBadgeBg);
  doc.restore();
  doc.font("bodyBold").fontSize(theme.fontSize.small).fillColor(p.subagentBadgeFg);
  doc.text(badgeText, x + 6, y + 3, { lineBreak: false, width: w - 12 });
  doc.y = y + h + 4;

  // Recurse turns with a left rule indicator
  for (const turn of block.conversation.turns) {
    renderSubagentTurn(doc, theme, turn, opts, subIndent);
  }
  spacer(doc, theme, theme.spacing.block);
}

function renderSubagentTurn(
  doc: Doc,
  theme: Theme,
  turn: Turn,
  opts: RenderOptions,
  indent: number,
): void {
  // Draw a thin left rule alongside sub-agent content. Implement by drawing
  // a rule on the leftmost column for the duration of the turn.
  const startY = doc.y;
  rolePill(doc, theme, turn.role);
  renderBlocks(doc, theme, turn.blocks, opts, indent);
  // Left rule from startY to doc.y
  const ruleX = theme.page.margin + indent - 8;
  doc.save();
  doc.rect(ruleX, startY, 2, Math.max(2, doc.y - startY - 2)).fill(theme.palette.subagentRule);
  doc.restore();
  spacer(doc, theme, theme.spacing.paragraph);
}

export function renderConversation(
  doc: Doc,
  theme: Theme,
  conv: NormalizedConversation,
  opts: RenderOptions,
): void {
  // Cover
  renderCover(doc, theme, conv);

  for (const turn of conv.turns) {
    rolePill(doc, theme, turn.role);
    if (turn.timestamp) {
      doc
        .font("bodyItalic")
        .fontSize(theme.fontSize.small)
        .fillColor(theme.palette.muted);
      doc.text(formatTs(turn.timestamp), theme.page.margin, doc.y, { lineBreak: false });
      doc.y += theme.fontSize.small + 2;
    }
    renderBlocks(doc, theme, turn.blocks, opts, 0);
    hrule(doc, theme, theme.palette.rule, 4);
  }

  if (opts.subagentMode === "appendix") {
    renderAppendix(doc, theme, conv, opts);
  }
}

function renderCover(doc: Doc, theme: Theme, conv: NormalizedConversation): void {
  const p = theme.palette;
  doc.font("bodyBold").fontSize(theme.fontSize.title).fillColor(p.fg);
  doc.text(conv.title || conv.id, theme.page.margin, doc.y, {
    width: contentWidth(theme),
  });
  doc.y += 6;
  doc.font("body").fontSize(theme.fontSize.small).fillColor(p.muted);
  const meta: string[] = [];
  meta.push(`agent: ${conv.agent}`);
  if (conv.model) meta.push(`model: ${conv.model}`);
  if (conv.cwd) meta.push(`cwd: ${conv.cwd}`);
  if (conv.gitBranch) meta.push(`branch: ${conv.gitBranch}`);
  if (conv.startedAt) meta.push(`started: ${formatTs(conv.startedAt)}`);
  if (conv.endedAt && conv.endedAt !== conv.startedAt) meta.push(`ended: ${formatTs(conv.endedAt)}`);
  meta.push(`turns: ${conv.turns.length}`);
  doc.text(meta.join("  ·  "), theme.page.margin, doc.y, {
    width: contentWidth(theme),
  });
  doc.y += theme.fontSize.small + 6;
  hrule(doc, theme, p.rule, 8);
}

function renderAppendix(
  doc: Doc,
  theme: Theme,
  conv: NormalizedConversation,
  opts: RenderOptions,
): void {
  const subs = collectSubagents(conv);
  if (subs.length === 0) return;
  doc.addPage();
  doc.font("bodyBold").fontSize(theme.fontSize.h1).fillColor(theme.palette.fg);
  doc.text("Appendix — Sub-agents", theme.page.margin, doc.y);
  doc.y += theme.fontSize.h1 + 6;
  for (const sub of subs) {
    renderSubagentInline(doc, theme, sub, { ...opts, subagentMode: "inline" }, 0);
  }
}

function collectSubagents(conv: NormalizedConversation): Array<Block & { kind: "subagent" }> {
  const out: Array<Block & { kind: "subagent" }> = [];
  for (const turn of conv.turns) {
    for (const b of turn.blocks) {
      if (b.kind === "subagent") {
        out.push(b);
        out.push(...collectSubagents(b.conversation));
      }
    }
  }
  return out;
}

function formatTs(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
  } catch {
    return iso;
  }
}
