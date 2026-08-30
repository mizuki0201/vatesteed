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
    "stream-json",
    "--verbose",
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

test("pnpm run の区切りを除いてタスクMarkdownを受け取る", () => {
  assert.deepEqual(parseClaudeCommand(["--", "--task", "docs/tasks/example.md"]), {
    kind: "new",
    taskPath: "docs/tasks/example.md",
  });
});

test("依頼文の直接指定を受け取らない", () => {
  assert.throws(() => parseClaudeCommand([]), /使い方/);
  assert.throws(() => parseClaudeCommand(["--", "直接の依頼文"]), /使い方/);
});

test("接続確認を専用の引数で受け取る", () => {
  assert.deepEqual(parseClaudeCommand(["--", "--check-auth"]), { kind: "check-auth" });
});

test("明示的に最初からやり直す操作を受け取る", () => {
  assert.deepEqual(
    parseClaudeCommand(["--", "--restart", "--task", "docs/tasks/example.md"]),
    { kind: "restart", taskPath: "docs/tasks/example.md" },
  );
});

test("実行記録のIDを指定して再開を受け取る", () => {
  assert.deepEqual(
    parseClaudeCommand(["--", "--resume", "20260828-093012-a1b2c3d4", "--task", "docs/tasks/example.md"]),
    { kind: "resume", runId: "20260828-093012-a1b2c3d4", taskPath: "docs/tasks/example.md" },
  );
});

test("再開はpnpm runの区切りを省いてもよい", () => {
  assert.deepEqual(parseClaudeCommand(["--resume", "20260828-093012-a1b2c3d4", "--task", "docs/tasks/example.md"]), {
    kind: "resume",
    runId: "20260828-093012-a1b2c3d4",
    taskPath: "docs/tasks/example.md",
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
    () => parseClaudeCommand(["--", "--resume", "../../etc/passwd", "--task", "docs/tasks/example.md"]),
    /IDの形式/,
  );
});
