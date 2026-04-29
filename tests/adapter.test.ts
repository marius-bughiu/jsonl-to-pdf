import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { claudeCodeAdapter } from "../src/adapters/claude-code.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "fixtures", "simple", "session.jsonl");

test("claude-code adapter detects fixture", async () => {
  assert.equal(await claudeCodeAdapter.detect(fixturePath), true);
});

test("claude-code adapter loads turns and metadata", async () => {
  const conv = await claudeCodeAdapter.load(fixturePath);
  assert.equal(conv.agent, "claude-code");
  assert.equal(conv.title, "Test fixture conversation");
  assert.equal(conv.cwd, "C:\\test\\proj");
  assert.equal(conv.gitBranch, "main");
  assert.equal(conv.model, "claude-opus-4-7");
  assert.ok(conv.turns.length >= 4, `expected ≥4 turns, got ${conv.turns.length}`);
});

test("thinking blocks are included by default", async () => {
  const conv = await claudeCodeAdapter.load(fixturePath);
  const hasReasoning = conv.turns.some((t) =>
    t.blocks.some((b) => b.kind === "reasoning"),
  );
  assert.equal(hasReasoning, true);
});

test("thinking blocks excluded when includeThinking=false", async () => {
  const conv = await claudeCodeAdapter.load(fixturePath, {
    includeThinking: false,
  });
  const hasReasoning = conv.turns.some((t) =>
    t.blocks.some((b) => b.kind === "reasoning"),
  );
  assert.equal(hasReasoning, false);
});

test("tool_use becomes toolCall block", async () => {
  const conv = await claudeCodeAdapter.load(fixturePath);
  const tc = conv.turns
    .flatMap((t) => t.blocks)
    .find((b) => b.kind === "toolCall" && b.name === "Bash");
  assert.ok(tc, "Bash toolCall block should exist");
});

test("tool_result becomes toolResult block", async () => {
  const conv = await claudeCodeAdapter.load(fixturePath);
  const tr = conv.turns
    .flatMap((t) => t.blocks)
    .find((b) => b.kind === "toolResult");
  assert.ok(tr, "toolResult block should exist");
  if (tr.kind === "toolResult") {
    assert.match(tr.output, /file1\.ts/);
  }
});

test("sub-agent is inlined at the Task tool_use", async () => {
  const conv = await claudeCodeAdapter.load(fixturePath);
  // Find the assistant turn that has the Task call AND a subagent block.
  const turn = conv.turns.find((t) => {
    const names = t.blocks.map((b) => b.kind);
    return names.includes("toolCall") && names.includes("subagent");
  });
  assert.ok(turn, "assistant turn should contain both toolCall and subagent blocks");
  const sub = turn.blocks.find((b) => b.kind === "subagent");
  if (sub && sub.kind === "subagent") {
    assert.equal(sub.agentType, "Explore");
    assert.ok(sub.conversation.turns.length >= 1);
  }
});

test("sub-agents excluded when includeSubagents=false", async () => {
  const conv = await claudeCodeAdapter.load(fixturePath, {
    includeSubagents: false,
  });
  const sub = conv.turns
    .flatMap((t) => t.blocks)
    .find((b) => b.kind === "subagent");
  assert.equal(sub, undefined);
});
