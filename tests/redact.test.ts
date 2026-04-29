import { test } from "node:test";
import assert from "node:assert/strict";
import { redact } from "../src/utils/redact.js";

test("redacts AWS access keys", () => {
  const out = redact("aws key: AKIAIOSFODNN7EXAMPLE end");
  assert.match(out, /\[redacted:aws-access-key\]/);
  assert.doesNotMatch(out, /AKIAIOSFODNN7EXAMPLE/);
});

test("redacts GitHub tokens", () => {
  const out = redact("token: ghp_abcdefghijklmnopqrstuvwxyz0123456789 ");
  assert.match(out, /\[redacted:github-token\]/);
});

test("redacts Bearer headers", () => {
  const out = redact("Authorization: Bearer abc.def.ghijklmnopqrstuv");
  assert.match(out, /\[redacted:bearer\]/);
});

test("redacts Anthropic and OpenAI keys", () => {
  const out1 = redact("ANTHROPIC=sk-ant-1234567890abcdefghij");
  assert.match(out1, /\[redacted:anthropic-key\]/);
  const out2 = redact("OPENAI=sk-1234567890abcdefghij");
  assert.match(out2, /\[redacted:openai-key\]/);
});

test("leaves benign text alone", () => {
  const text = "This is a normal sentence about programming.";
  assert.equal(redact(text), text);
});
