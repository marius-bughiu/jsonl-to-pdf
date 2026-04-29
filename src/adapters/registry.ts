import type { Adapter } from "./types.js";
import { claudeCodeAdapter } from "./claude-code.js";

export const adapters: Record<string, Adapter> = {
  "claude-code": claudeCodeAdapter,
};

export async function detectAdapter(filePath: string): Promise<Adapter | null> {
  for (const a of Object.values(adapters)) {
    try {
      if (await a.detect(filePath)) return a;
    } catch {
      // try next
    }
  }
  return null;
}

export function getAdapter(id: string): Adapter | null {
  return adapters[id] ?? null;
}
