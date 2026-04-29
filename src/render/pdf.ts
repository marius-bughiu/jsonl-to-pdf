import { createWriteStream } from "node:fs";
import { Writable } from "node:stream";
import PDFDocument from "pdfkit";
import type { NormalizedConversation } from "../model/ir.js";
import { renderConversation, type RenderOptions } from "./blocks.js";
import { makeTheme } from "./theme.js";
import { loadFonts, registerFonts } from "./fonts.js";

export interface RenderToPdfOptions extends RenderOptions {
  dark: boolean;
  /** Output destination: file path, "-" for stdout, or a Writable stream. */
  output: string | Writable;
}

export async function renderToPdf(
  conv: NormalizedConversation,
  opts: RenderToPdfOptions,
): Promise<void> {
  const theme = makeTheme(opts.dark);
  const fonts = await loadFonts();

  const doc = new PDFDocument({
    autoFirstPage: false,
    size: [theme.page.width, theme.page.height],
    margin: theme.page.margin,
    bufferPages: false,
    info: {
      Title: conv.title ?? conv.id,
      Author: `jsonl-to-pdf (${conv.agent})`,
      Producer: "jsonl-to-pdf",
      Creator: "jsonl-to-pdf",
      CreationDate: conv.endedAt ? new Date(conv.endedAt) : new Date(0),
    },
  });
  registerFonts(doc, fonts);

  const stream =
    typeof opts.output === "string"
      ? opts.output === "-"
        ? process.stdout
        : createWriteStream(opts.output)
      : opts.output;

  const target = stream as Writable;
  const done = new Promise<void>((resolve, reject) => {
    if (target === (process.stdout as unknown as Writable)) {
      doc.on("end", () => resolve());
    } else {
      target.once("finish", () => resolve());
      target.once("error", reject);
    }
    doc.on("error", reject);
  });

  doc.pipe(target, { end: target !== (process.stdout as unknown as Writable) });

  // Set background fill behaviour: PDFKit doesn't have page-bg by default.
  // We fill the page rect on each new page.
  const fillBg = (): void => {
    doc.save();
    doc.rect(0, 0, theme.page.width, theme.page.height).fill(theme.palette.bg);
    doc.restore();
    doc.x = theme.page.margin;
    doc.y = theme.page.margin;
  };
  doc.on("pageAdded", fillBg);

  doc.addPage();
  // After the first page is added, the listener fires and resets cursor.

  renderConversation(doc, theme, conv, opts);

  doc.end();
  await done;
}
