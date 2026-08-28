import assert from "node:assert/strict";
import { test } from "node:test";
import { checkClaudeResult } from "./result.ts";

/** 検証を通る最終結果。各テストはここから1項目だけ崩す。 */
function successResult(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    result: "AUTH_OK",
    terminal_reason: "completed",
    modelUsage: { "claude-opus-5": { totalInputTokens: 10, totalOutputTokens: 2 } },
    subagent_stats: { spawned: 0 },
    session_id: "11111111-2222-3333-4444-555555555555",
    ...overrides,
  });
}

test("すべての条件を満たした結果だけを完了とする", () => {
  const check = checkClaudeResult(successResult());

  assert.equal(check.ok, true);
  assert.equal(check.ok && check.result, "AUTH_OK");
  assert.equal(check.sessionId, "11111111-2222-3333-4444-555555555555");
  assert.equal(check.model, "claude-opus-5");
  assert.equal(check.subagentsSpawned, 0);
});

test("日付が付いたモデルIDも Opus 5 として通す", () => {
  const check = checkClaudeResult(
    successResult({ modelUsage: { "claude-opus-5-20260101": { totalInputTokens: 1 } } }),
  );

  assert.equal(check.ok, true);
  assert.equal(check.model, "claude-opus-5-20260101");
});

test("空の標準出力を成功として扱わない", () => {
  const check = checkClaudeResult("   \n");

  assert.equal(check.ok, false);
  assert.match(check.ok ? "" : check.reason, /標準出力が空/);
});

test("JSON として読めない出力を成功として扱わない", () => {
  const check = checkClaudeResult("Usage limit reached. Try again later.");

  assert.equal(check.ok, false);
  assert.match(check.ok ? "" : check.reason, /JSON として読めなかった/);
});

test("is_error が立った結果を成功として扱わない", () => {
  const check = checkClaudeResult(
    JSON.stringify({
      type: "result",
      subtype: "error_during_execution",
      is_error: true,
      errors: ["429 rate limit"],
      terminal_reason: "api_error",
      modelUsage: { "claude-opus-5": {} },
      session_id: "11111111-2222-3333-4444-555555555555",
    }),
  );

  assert.equal(check.ok, false);
  assert.match(check.ok ? "" : check.reason, /error_during_execution/);
});

test("利用枠エラーでもセッションIDは拾って再開できるようにする", () => {
  const check = checkClaudeResult(
    JSON.stringify({
      type: "result",
      subtype: "error_max_turns",
      is_error: true,
      terminal_reason: "max_turns",
      modelUsage: { "claude-opus-5": {} },
      session_id: "aaaa-bbbb",
    }),
  );

  assert.equal(check.ok, false);
  assert.equal(check.sessionId, "aaaa-bbbb");
});

test("終了理由が completed でなければ成功として扱わない", () => {
  const check = checkClaudeResult(successResult({ terminal_reason: "max_turns" }));

  assert.equal(check.ok, false);
  assert.match(check.ok ? "" : check.reason, /completed ではなかった/);
});

test("終了理由の項目が無ければ成功として扱わない", () => {
  const check = checkClaudeResult(successResult({ terminal_reason: undefined }));

  assert.equal(check.ok, false);
  assert.match(check.ok ? "" : check.reason, /completed ではなかった/);
});

test("Opus 5 以外のモデルを成功として扱わない", () => {
  const check = checkClaudeResult(successResult({ modelUsage: { "claude-sonnet-5": {} } }));

  assert.equal(check.ok, false);
  assert.match(check.ok ? "" : check.reason, /claude-opus-5 が無かった/);
});

test("子エージェントが起動した結果を成功として扱わない", () => {
  const check = checkClaudeResult(successResult({ subagent_stats: { spawned: 3 } }));

  assert.equal(check.ok, false);
  assert.match(check.ok ? "" : check.reason, /子エージェントが 3 個/);
});

test("子エージェントの項目が無い出力は0として扱う", () => {
  const check = checkClaudeResult(successResult({ subagent_stats: undefined }));

  assert.equal(check.ok, true);
  assert.equal(check.subagentsSpawned, 0);
});

test("子エージェント数が数値でなければ成功として扱わない", () => {
  const check = checkClaudeResult(successResult({ subagent_stats: { spawned: "0" } }));

  assert.equal(check.ok, false);
  assert.match(check.ok ? "" : check.reason, /数値として読めなかった/);
});

test("結果本文が文字列でなければ成功として扱わない", () => {
  const check = checkClaudeResult(successResult({ result: { text: "AUTH_OK" } }));

  assert.equal(check.ok, false);
  assert.match(check.ok ? "" : check.reason, /結果本文が文字列ではなかった/);
});

test("最終結果ではない JSON を成功として扱わない", () => {
  const check = checkClaudeResult(JSON.stringify({ type: "assistant", is_error: false }));

  assert.equal(check.ok, false);
  assert.match(check.ok ? "" : check.reason, /最終結果ではなかった/);
});

test("session_id が無ければ成功として扱わない", () => {
  const check = checkClaudeResult(successResult({ session_id: "" }));

  assert.equal(check.ok, false);
  assert.match(check.ok ? "" : check.reason, /session_id が取れなかった/);
});
