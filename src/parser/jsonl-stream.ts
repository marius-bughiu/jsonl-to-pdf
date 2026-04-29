import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

export interface ParsedLine<T = unknown> {
  lineNumber: number;
  raw: string;
  value: T | null;
  error?: Error;
}

export async function* readJsonlLines<T = unknown>(
  path: string,
): AsyncGenerator<ParsedLine<T>> {
  const stream = createReadStream(path, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let lineNumber = 0;
  for await (const raw of rl) {
    lineNumber++;
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    try {
      const value = JSON.parse(trimmed) as T;
      yield { lineNumber, raw: trimmed, value };
    } catch (err) {
      yield {
        lineNumber,
        raw: trimmed,
        value: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }
}

export async function readAllJsonl<T = unknown>(path: string): Promise<T[]> {
  const out: T[] = [];
  for await (const line of readJsonlLines<T>(path)) {
    if (line.value !== null) out.push(line.value);
  }
  return out;
}
