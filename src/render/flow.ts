import type PDFDocument from "pdfkit";
import type { Theme } from "./theme.js";

export type Doc = InstanceType<typeof PDFDocument>;

export interface TextStyle {
  font: "body" | "bodyBold" | "bodyItalic" | "mono" | "monoBold";
  size: number;
  color: string;
  /** Background fill behind text lines. */
  bg?: string;
  /** Border color drawn as a left rule. */
  leftRule?: string;
  /** Width of the left rule in points. */
  leftRuleWidth?: number;
  /** Indent (in points) from `box.x` for text. The box itself is unaffected. */
  textIndent?: number;
}

export interface Box {
  x: number;
  width: number;
  paddingX: number;
  paddingY: number;
}

const FONT_KEYS: Record<TextStyle["font"], string> = {
  body: "body",
  bodyBold: "bodyBold",
  bodyItalic: "bodyItalic",
  mono: "mono",
  monoBold: "monoBold",
};

function setFont(doc: Doc, style: TextStyle): void {
  doc.font(FONT_KEYS[style.font]).fontSize(style.size).fillColor(style.color);
}

function lineHeight(style: TextStyle): number {
  // PDFKit's currentLineHeight depends on the active font. Use a conservative
  // multiplier so descenders don't get clipped.
  return style.size * 1.35;
}

/** Bottom y boundary of the page content area. */
function pageBottom(doc: Doc, theme: Theme): number {
  return theme.page.height - theme.page.margin;
}

/** Available content width. */
export function contentWidth(theme: Theme): number {
  return theme.page.width - theme.page.margin * 2;
}

/** Soft-wrap a string at word boundaries to fit `maxWidth` (in points). */
function wrapProse(doc: Doc, text: string, style: TextStyle, maxWidth: number): string[] {
  setFont(doc, style);
  const out: string[] = [];
  // Preserve explicit newlines as paragraph breaks; within each, soft-wrap.
  for (const para of text.split(/\r?\n/)) {
    if (para.length === 0) {
      out.push("");
      continue;
    }
    const words = para.split(/(\s+)/); // keep whitespace tokens
    let line = "";
    for (const w of words) {
      const candidate = line + w;
      if (doc.widthOfString(candidate) <= maxWidth) {
        line = candidate;
      } else {
        if (line.trim().length > 0) out.push(line);
        // If a single token is itself longer than maxWidth, hard-break it.
        if (doc.widthOfString(w) > maxWidth) {
          let chunk = "";
          for (const ch of w) {
            if (doc.widthOfString(chunk + ch) > maxWidth) {
              if (chunk) out.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          line = chunk;
        } else {
          line = w.replace(/^\s+/, "");
        }
      }
    }
    if (line.trim().length > 0) out.push(line);
  }
  return out;
}

/** Wrap monospace code preserving whitespace. */
function wrapCode(doc: Doc, text: string, style: TextStyle, maxWidth: number): string[] {
  setFont(doc, style);
  const out: string[] = [];
  for (const lineRaw of text.split(/\r?\n/)) {
    const expanded = lineRaw.replace(/\t/g, "    ");
    if (doc.widthOfString(expanded) <= maxWidth) {
      out.push(expanded);
      continue;
    }
    // Char-level break for long code lines.
    let chunk = "";
    for (const ch of expanded) {
      if (doc.widthOfString(chunk + ch) > maxWidth) {
        out.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    if (chunk.length > 0) out.push(chunk);
  }
  return out;
}

export function ensureSpace(doc: Doc, theme: Theme, needed: number): void {
  if (doc.y + needed > pageBottom(doc, theme)) {
    doc.addPage();
  }
}

/**
 * Render wrapped lines into a box, drawing optional background and left rule.
 * Handles page breaks by chunking into page-sized slices and re-drawing the
 * box on each new page.
 */
function drawLines(
  doc: Doc,
  theme: Theme,
  box: Box,
  style: TextStyle,
  lines: string[],
): void {
  if (lines.length === 0) return;
  const lh = lineHeight(style);
  const indent = style.textIndent ?? 0;
  const ruleW = style.leftRuleWidth ?? 0;
  const textX = box.x + box.paddingX + indent + ruleW;
  let i = 0;
  while (i < lines.length) {
    // How many lines fit on the current page?
    const available = pageBottom(doc, theme) - (doc.y + box.paddingY);
    const fit = Math.max(1, Math.floor(available / lh));
    const slice = lines.slice(i, i + fit);
    const blockH = slice.length * lh + box.paddingY * 2;

    // If even one line doesn't fit, page-break (unless we're at the top).
    if (available < lh && doc.y > theme.page.margin + 1) {
      doc.addPage();
      continue;
    }

    const startY = doc.y;
    if (style.bg) {
      doc.save();
      doc.rect(box.x, startY, box.width, blockH).fill(style.bg);
      doc.restore();
    }
    if (style.leftRule && ruleW > 0) {
      doc.save();
      doc.rect(box.x, startY, ruleW, blockH).fill(style.leftRule);
      doc.restore();
    }
    setFont(doc, style);
    let y = startY + box.paddingY;
    for (const line of slice) {
      doc.text(line, textX, y, { lineBreak: false, width: box.width - box.paddingX * 2 - indent - ruleW });
      y += lh;
    }
    doc.y = startY + blockH;
    i += slice.length;
    if (i < lines.length) {
      doc.addPage();
    }
  }
}

export function flowProse(
  doc: Doc,
  theme: Theme,
  box: Box,
  style: TextStyle,
  text: string,
): void {
  const innerWidth = box.width - box.paddingX * 2 - (style.textIndent ?? 0) - (style.leftRuleWidth ?? 0);
  const lines = wrapProse(doc, text, style, innerWidth);
  drawLines(doc, theme, box, style, lines);
}

export function flowCode(
  doc: Doc,
  theme: Theme,
  box: Box,
  style: TextStyle,
  text: string,
): void {
  const innerWidth = box.width - box.paddingX * 2 - (style.textIndent ?? 0) - (style.leftRuleWidth ?? 0);
  const lines = wrapCode(doc, text, style, innerWidth);
  drawLines(doc, theme, box, style, lines);
}

/** Move the cursor down by `n` points, page-breaking if necessary. */
export function spacer(doc: Doc, theme: Theme, n: number): void {
  if (doc.y + n > pageBottom(doc, theme)) {
    doc.addPage();
    return;
  }
  doc.y += n;
}

/** Draw a single horizontal rule at the current y. */
export function hrule(doc: Doc, theme: Theme, color: string, padding = 6): void {
  const x = theme.page.margin;
  const w = contentWidth(theme);
  ensureSpace(doc, theme, padding * 2 + 1);
  doc.y += padding;
  doc.save();
  doc.rect(x, doc.y, w, 0.6).fill(color);
  doc.restore();
  doc.y += padding;
}
