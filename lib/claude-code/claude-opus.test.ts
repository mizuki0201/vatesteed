import assert from "node:assert/strict";
import { test } from "node:test";
import { buildClaudeOpusArgs, parseClaudeCommand } from "./claude-opus.ts";

test("Claude Code を Opus 指定で非対話実行する", () => {
  assert.deepEqual(buildClaudeOpusArgs({ prompt: "AUTH_OK だけを返す" }), [
    "-p",
    "--disallowedTools",
    "Agent",
    "--model",
    "opus",
    "--output-format",
    "json",
    "--max-turns",
    "24",
    "AUTH_OK だけを返す",
  ]);
});

test("依頼文は複数の値を取るオプションの直後に置かない", () => {
  const args = buildClaudeOpusArgs({ prompt: "AUTH_OK だけを返す" });
  const afterDisallowed = args[args.indexOf("--disallowedTools") + 2];

  assert.equal(afterDisallowed, "--model");
});

test("再開のときは同じセッションIDを渡す", () => {
  const args = buildClaudeOpusArgs({
    prompt: "続きをやる",
    resumeSessionId: "11111111-2222-3333-4444-555555555555",
  });

  assert.deepEqual(args.slice(args.indexOf("--resume")), [
    "--resume",
    "11111111-2222-3333-4444-555555555555",
    "--max-turns",
    "24",
    "続きをやる",
  ]);
});

test("空の依頼文は実行しない", () => {
  assert.throws(() => buildClaudeOpusArgs({ prompt: "   " }), /依頼文が空/);
});

test("空のセッションIDでは再開しない", () => {
  assert.throws(
    () => buildClaudeOpusArgs({ prompt: "続きをやる", resumeSessionId: " " }),
    /セッションIDが空/,
  );
});

test("pnpm run の区切りを除いて依頼文を受け取る", () => {
  assert.deepEqual(parseClaudeCommand(["--", "AUTH_OK だけを返す"]), {
    kind: "new",
    prompt: "AUTH_OK だけを返す",
  });
});

test("依頼文が1つでなければ実行しない", () => {
  assert.throws(() => parseClaudeCommand([]), /使い方/);
  assert.throws(() => parseClaudeCommand(["--", "1", "2"]), /使い方/);
});

test("実行記録のIDを指定して再開を受け取る", () => {
  assert.deepEqual(
    parseClaudeCommand(["--", "--resume", "20260828-093012-a1b2c3d4", "--", "続きをやる"]),
    { kind: "resume", runId: "20260828-093012-a1b2c3d4", prompt: "続きをやる" },
  );
});

test("再開の内側の区切りは省いてもよい", () => {
  assert.deepEqual(parseClaudeCommand(["--resume", "20260828-093012-a1b2c3d4", "続きをやる"]), {
    kind: "resume",
    runId: "20260828-093012-a1b2c3d4",
    prompt: "続きをやる",
  });
});

test("再開の形式が合わなければ新規実行に切り替えない", () => {
  assert.throws(() => parseClaudeCommand(["--", "--resume"]), /使い方/);
  assert.throws(
    () => parseClaudeCommand(["--", "--resume", "20260828-093012-a1b2c3d4"]),
    /使い方/,
  );
});

test("実行記録のIDにファイル名として使えない値を渡さない", () => {
  assert.throws(
    () => parseClaudeCommand(["--", "--resume", "../../etc/passwd", "--", "続きをやる"]),
    /IDの形式/,
  );
});
