import assert from "node:assert/strict";
import { test } from "node:test";
import { buildClaudeOpusArgs, extractClaudePrompt } from "./claude-opus.ts";

test("Claude Code を Opus 指定で非対話実行する", () => {
  assert.deepEqual(buildClaudeOpusArgs("AUTH_OK だけを返す"), [
    "-p",
    "--model",
    "opus",
    "--output-format",
    "json",
    "AUTH_OK だけを返す",
  ]);
});

test("空の依頼文は実行しない", () => {
  assert.throws(() => buildClaudeOpusArgs("   "), /依頼文が空/);
});

test("pnpm run の区切りを除いて依頼文を受け取る", () => {
  assert.equal(extractClaudePrompt(["--", "AUTH_OK だけを返す"]), "AUTH_OK だけを返す");
});

test("依頼文が1つでなければ実行しない", () => {
  assert.throws(() => extractClaudePrompt([]), /使い方/);
  assert.throws(() => extractClaudePrompt(["--", "1", "2"]), /使い方/);
});
