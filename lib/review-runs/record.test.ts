import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  listReviewRuns,
  loadReviewRun,
  parseReviewRun,
  type ReviewRunRecord,
  reviewRunPath,
  saveReviewRun,
} from "./record.ts";

const RUN_ID = "20260906-153206-9fd2dc6c";

function record(overrides: Partial<ReviewRunRecord> = {}): ReviewRunRecord {
  return {
    runId: RUN_ID,
    taskPath: "docs/tasks/example.md",
    taskTitle: "例のタスク",
    mode: "development",
    firstReport: "状態: 完了",
    firstReportAt: "2026-09-06T06:32:06.000Z",
    rounds: [],
    createdAt: "2026-09-06T06:32:06.000Z",
    updatedAt: "2026-09-06T06:32:06.000Z",
    ...overrides,
  };
}

async function makeDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vatesteed-review-"));
}

test("実行記録のIDから年月のディレクトリを決める", () => {
  assert.equal(
    reviewRunPath("/tmp/review-runs", RUN_ID),
    path.join("/tmp/review-runs", "2026-09", `${RUN_ID}.json`),
  );
});

test("実行記録のIDでない値では保存先を作らない", () => {
  assert.throws(() => reviewRunPath("/tmp/review-runs", "../../etc/passwd"), /形式が違います/);
  assert.throws(() => reviewRunPath("/tmp/review-runs", "20260906"), /形式が違います/);
});

test("保存した記録をそのまま読み直せる", async () => {
  const dir = await makeDir();
  const saved = record({
    rounds: [
      {
        number: 1,
        notes: ["往復の数え方が違う"],
        openedAt: "2026-09-06T07:00:00.000Z",
        reply: "状態: 完了",
        repliedAt: "2026-09-06T07:30:00.000Z",
      },
    ],
  });

  await saveReviewRun(dir, saved);

  assert.deepEqual(await loadReviewRun(dir, RUN_ID), saved);
});

test("半分だけ書かれたJSONを残さない", async () => {
  const dir = await makeDir();
  await saveReviewRun(dir, record());

  const files = await readdir(path.join(dir, "2026-09"));
  assert.deepEqual(files, [`${RUN_ID}.json`]);
  // 置き換えで書くので、読み手が読めるのは完全なJSONだけになる。
  assert.deepEqual(parseReviewRun(await readFile(reviewRunPath(dir, RUN_ID), "utf8")), record());
});

test("まだ記録が無ければ null を返す", async () => {
  const dir = await makeDir();

  assert.equal(await loadReviewRun(dir, RUN_ID), null);
});

test("年月をまたいだ記録を新しい順に読む", async () => {
  const dir = await makeDir();
  const older = "20260831-101112-aaaaaaaa";
  await saveReviewRun(dir, record());
  await saveReviewRun(dir, record({ runId: older, taskTitle: "先月のタスク" }));

  const records = await listReviewRuns(dir);

  assert.deepEqual(
    records.map((item) => item.runId),
    [RUN_ID, older],
  );
});

test("記録がまだ1件も無いディレクトリは空で返す", async () => {
  const dir = await makeDir();

  assert.deepEqual(await listReviewRuns(dir), []);
});

test("壊れた記録は読まずに例外にする", async () => {
  assert.throws(() => parseReviewRun("{"), /JSON として読めません/);
  assert.throws(() => parseReviewRun(JSON.stringify({ ...record(), mode: "その他" })), /mode/);
  assert.throws(
    () =>
      parseReviewRun(
        JSON.stringify(
          record({
            rounds: [
              { number: 2, notes: [], openedAt: "2026-09-06T07:00:00.000Z", reply: null, repliedAt: null },
            ],
          }),
        ),
      ),
    /往復番号/,
  );
});

test("読めない中身のファイルを一覧で黙って飛ばさない", async () => {
  const dir = await makeDir();
  await saveReviewRun(dir, record());
  await writeFile(reviewRunPath(dir, "20260906-160000-bbbbbbbb"), "{", "utf8");

  await assert.rejects(() => listReviewRuns(dir), /JSON として読めません/);
});
