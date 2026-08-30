import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  assertRunId,
  type ClaudeRunRecord,
  createRunId,
  findRunRecordsForTask,
  loadRunRecord,
  markRunIncomplete,
  parseRunRecord,
  resumableSessionId,
  saveRunRecord,
} from "./run-record.ts";

function makeRecord(overrides: Partial<ClaudeRunRecord> = {}): ClaudeRunRecord {
  return {
    runId: "20260828-093012-a1b2c3d4",
    sessionId: "11111111-2222-3333-4444-555555555555",
    taskPath: "docs/tasks/example.md",
    mode: "development",
    executorRole: "dev-implementer",
    state: "incomplete",
    exitCode: 1,
    terminalReason: "max_turns",
    model: "claude-opus-5",
    subagentsSpawned: 0,
    error: "終了理由が completed ではなかった（max_turns）。",
    result: null,
    startedAt: "2026-08-28T00:30:12.000Z",
    updatedAt: "2026-08-28T00:35:00.000Z",
    ...overrides,
  };
}

async function makeDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vatesteed-runs-"));
}

test("実行記録を書いて読み直す", async () => {
  const dir = await makeDir();
  const record = makeRecord();

  await saveRunRecord(dir, record);

  assert.deepEqual(await loadRunRecord(dir, record.runId), record);
});

test("書き込みは一時ファイルを残さない", async () => {
  const dir = await makeDir();
  const record = makeRecord();

  await saveRunRecord(dir, record);

  assert.deepEqual(await readdir(dir), [`${record.runId}.json`]);
});

test("同じIDへ書き直すと置き換わる", async () => {
  const dir = await makeDir();
  const record = makeRecord();

  await saveRunRecord(dir, record);
  await saveRunRecord(dir, makeRecord({ state: "completed", result: "できた", error: null }));

  const loaded = await loadRunRecord(dir, record.runId);
  assert.equal(loaded.state, "completed");
  assert.equal(loaded.result, "できた");
});

test("呼び出し側の検証に落ちた完了記録は同じセッションを再開できる状態へ戻す", async () => {
  const dir = await makeDir();
  const record = makeRecord({ state: "completed", error: null, result: "Claudeは完了した" });
  await saveRunRecord(dir, record);

  const marked = await markRunIncomplete(dir, record.runId, "保存結果が不足している。", () => new Date("2026-08-29T00:00:00.000Z"));

  assert.equal(marked.state, "incomplete");
  assert.equal(marked.result, null);
  assert.equal(marked.error, "保存結果が不足している。");
  assert.equal(resumableSessionId(marked), record.sessionId);
});

test("実行記録に依頼文や認証情報を書かない", async () => {
  const dir = await makeDir();
  const record = makeRecord();

  const written = await saveRunRecord(dir, record);
  const keys = Object.keys(JSON.parse(await readFile(written, "utf8")));

  assert.deepEqual(keys.sort(), Object.keys(record).sort());
});

test("実行記録が無ければ例外にする", async () => {
  const dir = await makeDir();

  await assert.rejects(() => loadRunRecord(dir, "20260828-093012-ffffffff"), /見つかりません/);
});

test("同じタスクMarkdownの実行記録だけを新しい順で返す", async () => {
  const dir = await makeDir();
  await saveRunRecord(dir, makeRecord({
    runId: "20260828-093012-a1b2c3d4",
    taskPath: "docs/tasks/target.md",
    startedAt: "2026-08-28T00:00:00.000Z",
  }));
  await saveRunRecord(dir, makeRecord({
    runId: "20260829-093012-a1b2c3d4",
    taskPath: "docs/tasks/target.md",
    startedAt: "2026-08-29T00:00:00.000Z",
  }));
  await saveRunRecord(dir, makeRecord({
    runId: "20260830-093012-a1b2c3d4",
    taskPath: "docs/tasks/other.md",
  }));

  assert.deepEqual(
    (await findRunRecordsForTask(dir, "docs/tasks/target.md")).map((record) => record.runId),
    ["20260829-093012-a1b2c3d4", "20260828-093012-a1b2c3d4"],
  );
});

test("壊れた実行記録を読み流さない", async () => {
  const dir = await makeDir();
  await writeFile(path.join(dir, "20260828-093012-a1b2c3d4.json"), "{壊れている", "utf8");

  await assert.rejects(
    () => loadRunRecord(dir, "20260828-093012-a1b2c3d4"),
    /JSON として読めません/,
  );
});

test("state が読めない実行記録を受け取らない", () => {
  assert.throws(
    () => parseRunRecord(JSON.stringify({ runId: "20260828-093012-a1b2c3d4", state: "ok" })),
    /state が/,
  );
});

test("完了済みの実行記録は再開しない", () => {
  assert.throws(
    () => resumableSessionId(makeRecord({ state: "completed" })),
    /完了済みです/,
  );
});

test("セッションIDが無い実行記録は再開しない", () => {
  assert.throws(() => resumableSessionId(makeRecord({ sessionId: null })), /セッションIDがありません/);
});

test("未完了の実行記録からセッションIDを取る", () => {
  assert.equal(resumableSessionId(makeRecord()), "11111111-2222-3333-4444-555555555555");
});

test("起動中の実行記録からも同じセッションを再開できる", () => {
  assert.equal(
    resumableSessionId(makeRecord({ state: "running" })),
    "11111111-2222-3333-4444-555555555555",
  );
});

test("旧形式の実行記録はタスク情報をnullとして読める", () => {
  const record = makeRecord();
  const { taskPath: _taskPath, mode: _mode, executorRole: _executorRole, ...legacy } = record;
  const parsed = parseRunRecord(JSON.stringify(legacy));
  assert.equal(parsed.taskPath, null);
  assert.equal(parsed.mode, null);
  assert.equal(parsed.executorRole, null);
});

test("ファイル名として使えない実行記録のIDを弾く", () => {
  assert.throws(() => assertRunId("../secret"), /IDの形式/);
  assert.throws(() => assertRunId("20260828-093012-a1b2c3d4/x"), /IDの形式/);
  assert.equal(assertRunId("20260828-093012-a1b2c3d4"), "20260828-093012-a1b2c3d4");
});

test("実行記録のIDは時刻から作る", () => {
  const runId = createRunId(new Date(2026, 7, 28, 9, 30, 12), "a1b2c3d4");

  assert.equal(runId, "20260828-093012-a1b2c3d4");
  assert.doesNotThrow(() => assertRunId(createRunId()));
});
