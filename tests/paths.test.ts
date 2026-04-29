import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeProjectDir } from "../src/discovery/paths.js";

test("encodeProjectDir round-trips Windows paths", () => {
  if (process.platform !== "win32") return;
  assert.equal(encodeProjectDir("C:\\S\\jsonl-to-pdf"), "C--S-jsonl-to-pdf");
  assert.equal(encodeProjectDir("D:/Users/foo/bar"), "D--Users-foo-bar");
});

test("encodeProjectDir round-trips POSIX paths", () => {
  if (process.platform === "win32") return;
  assert.equal(encodeProjectDir("/home/foo/bar"), "-home-foo-bar");
});
