import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Doc } from "./flow.js";

export interface Fonts {
  body: Buffer | "Helvetica";
  bodyBold: Buffer | "Helvetica-Bold";
  bodyItalic: Buffer | "Helvetica-Oblique";
  mono: Buffer | "Courier";
  monoBold: Buffer | "Courier-Bold";
}

function tryRead(path: string): Buffer | null {
  try {
    if (existsSync(path)) return readFileSync(path);
  } catch {
    // ignore
  }
  return null;
}

/**
 * Locate the bundled assets/ directory. Works for:
 *  - `tsx` / dev: walks up from src/render/ to repo root
 *  - compiled npm: walks up from dist/render/ to package root
 *  - bun --compile: assets must be embedded (TODO v0.2); for now we fall back
 *    to PDFKit's built-in fonts so the binary still works.
 */
function assetsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // src/render → ../.. ; dist/render → ../..
  const candidates = [
    join(here, "..", "..", "assets"),
    join(here, "..", "assets"),
    join(process.cwd(), "assets"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

export async function loadFonts(): Promise<Fonts> {
  const dir = assetsDir();
  const inter = tryRead(join(dir, "Inter-Regular.ttf"));
  const interBold = tryRead(join(dir, "Inter-Bold.ttf"));
  const interItalic = tryRead(join(dir, "Inter-Italic.ttf"));
  const mono = tryRead(join(dir, "JetBrainsMono-Regular.ttf"));
  const monoBold = tryRead(join(dir, "JetBrainsMono-Bold.ttf"));
  return {
    body: inter ?? "Helvetica",
    bodyBold: interBold ?? "Helvetica-Bold",
    bodyItalic: interItalic ?? "Helvetica-Oblique",
    mono: mono ?? "Courier",
    monoBold: monoBold ?? "Courier-Bold",
  };
}

export function registerFonts(doc: Doc, fonts: Fonts): void {
  const reg = (name: string, src: Buffer | string): void => {
    if (typeof src === "string") {
      // PDFKit built-in font alias: registerFont with the alias works.
      doc.registerFont(name, src);
    } else {
      doc.registerFont(name, src);
    }
  };
  reg("body", fonts.body);
  reg("bodyBold", fonts.bodyBold);
  reg("bodyItalic", fonts.bodyItalic);
  reg("mono", fonts.mono);
  reg("monoBold", fonts.monoBold);
}
