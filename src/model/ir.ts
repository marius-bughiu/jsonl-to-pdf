export type Block =
  | { kind: "text"; text: string }
  | { kind: "reasoning"; text: string }
  | { kind: "code"; lang?: string; text: string }
  | { kind: "toolCall"; id: string; name: string; input: unknown }
  | { kind: "toolResult"; toolCallId: string; output: string; isError?: boolean }
  | { kind: "attachment"; mime: string; name?: string; data: Uint8Array | string }
  | {
      kind: "subagent";
      conversation: NormalizedConversation;
      agentType?: string;
      description?: string;
    }
  | { kind: "marker"; label: string; detail?: string }
  | { kind: "custom"; adapterId: string; data: unknown };

export type Role = "user" | "assistant" | "system";

export interface Turn {
  role: Role;
  blocks: Block[];
  timestamp?: string;
  uuid?: string;
}

export interface NormalizedConversation {
  id: string;
  title?: string;
  agent: string;
  cwd?: string;
  gitBranch?: string;
  model?: string;
  startedAt?: string;
  endedAt?: string;
  turns: Turn[];
}
