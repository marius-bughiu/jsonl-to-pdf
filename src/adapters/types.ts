import type { NormalizedConversation } from "../model/ir.js";

export interface AdapterOptions {
  includeSubagents?: boolean;
  includeThinking?: boolean;
  redact?: boolean;
}

export interface Adapter {
  id: string;
  /** Best-effort detection of whether this adapter can parse the given file. */
  detect(filePath: string): Promise<boolean>;
  load(filePath: string, opts?: AdapterOptions): Promise<NormalizedConversation>;
}
