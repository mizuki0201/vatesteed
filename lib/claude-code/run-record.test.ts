import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  assertRunId,
  type ClaudeRunRecord,
  createRunId,
  loadRunRecord,
  parseRunRecord,
  resumableSessionId,
  saveRunRecord,
} from "./run-record.ts";

function makeRecord(overrides: Partial<ClaudeRunRecord> = {}): ClaudeRunRecord {
  return {
    runId: "20260828-093012-a1b2c3d4",
    sessionId: "11111111-2222-3333-4444-555555555555",
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
