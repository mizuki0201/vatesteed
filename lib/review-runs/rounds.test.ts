import assert from "node:assert/strict";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { loadReviewRun } from "./record.ts";
import { openReviewRound, recordReviewReport } from "./rounds.ts";

const RUN_ID = "20260906-153206-9fd2dc6c";

/** 呼ばれた順に時刻を返す。保存された時刻を確かめるために使う。 */
function clock(...times: readonly string[]): () => Date {
  const queue = [...times];

  return () => new Date(queue.length > 1 ? (queue.shift() as string) : (queue[0] as string));
}

async function makeDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vatesteed-rounds-"));
}

function taskBody(acceptance: string): string {
  return `## テスト結果\n通った\n## 受け入れ結果\n${acceptance}\n## 保存確認\n確認済み\n`;
}

async function firstCompletion(dir: string): Promise<void> {
  await recordReviewReport({
    dir,
    runId: RUN_ID,
    taskPath: "docs/tasks/example.md",
    taskTitle: "例のタスク",
    mode: "development",
    report: "状態: 完了\n変更: 1件",
    now: clock("2026-09-06T06:00:00.000Z"),
  });
}

test("最初に正常完了した完了報告で、1依頼ぶんの記録を作る", async () => {
  const dir = await makeDir();
  await firstCompletion(dir);

  const saved = await loadReviewRun(dir, RUN_ID);

  assert.equal(saved?.firstReport, "状態: 完了\n変更: 1件");
  assert.equal(saved?.firstReportAt, "2026-09-06T06:00:00.000Z");
  assert.equal(saved?.mode, "development");
  assert.deepEqual(saved?.rounds, []);
});

test("この仕組みを入れる前の実行は、差し戻しから作り始めない", async () => {
  const dir = await makeDir();

  const opened = await openReviewRound({
    dir,
    runId: RUN_ID,
    taskBody: taskBody("- 差し戻し\n- 数え方が違う"),
  });

  assert.equal(opened, null);
  assert.deepEqual(await readdir(dir), []);
});

test("正常完了した実行を差し戻すと、指摘を持った往復が1件増える", async () => {
  const dir = await makeDir();
  await firstCompletion(dir);

  await openReviewRound({
    dir,
    runId: RUN_ID,
    taskBody: taskBody("- 差し戻し\n- 数え方が違う\n- 画面に出ていない"),
    now: clock("2026-09-06T07:00:00.000Z"),
  });

  const saved = await loadReviewRun(dir, RUN_ID);

  assert.equal(saved?.rounds.length, 1);
  assert.equal(saved?.rounds[0].number, 1);
  assert.deepEqual(saved?.rounds[0].notes, ["数え方が違う", "画面に出ていない"]);
  assert.equal(saved?.rounds[0].openedAt, "2026-09-06T07:00:00.000Z");
  assert.equal(saved?.rounds[0].reply, null);
});

test("差し戻しの印が無ければ、往復を増やさない", async () => {
  const dir = await makeDir();
  await firstCompletion(dir);
  const before = await loadReviewRun(dir, RUN_ID);

  await assert.rejects(
    () =>
      openReviewRound({
        dir,
        runId: RUN_ID,
        taskBody: taskBody("- 数え方が違う"),
      }),
    /「差し戻し」がありません/,
  );

  assert.deepEqual(await loadReviewRun(dir, RUN_ID), before);
});

test("具体的な指摘が無ければ、往復を増やさない", async () => {
  const dir = await makeDir();
  await firstCompletion(dir);
  const before = await loadReviewRun(dir, RUN_ID);

  await assert.rejects(
    () =>
      openReviewRound({
        dir,
        runId: RUN_ID,
        taskBody: taskBody("差し戻し"),
      }),
    /具体的な指摘がありません/,
  );

  assert.deepEqual(await loadReviewRun(dir, RUN_ID), before);
});

test("差し戻しの後の完了報告は、その往復の修正回答になる", async () => {
  const dir = await makeDir();
  await firstCompletion(dir);
  await openReviewRound({
    dir,
    runId: RUN_ID,
    taskBody: taskBody("差し戻し\n- 数え方が違う"),
    now: clock("2026-09-06T07:00:00.000Z"),
  });

  await recordReviewReport({
    dir,
    runId: RUN_ID,
    taskPath: "docs/tasks/example.md",
    taskTitle: "例のタスク",
    mode: "development",
    report: "状態: 完了\n変更: 数え方を直した",
    now: clock("2026-09-06T08:00:00.000Z"),
  });

  const saved = await loadReviewRun(dir, RUN_ID);

  assert.equal(saved?.firstReport, "状態: 完了\n変更: 1件");
  assert.equal(saved?.rounds.length, 1);
  assert.equal(saved?.rounds[0].reply, "状態: 完了\n変更: 数え方を直した");
  assert.equal(saved?.rounds[0].repliedAt, "2026-09-06T08:00:00.000Z");
});

test("差し戻した後に止まり、もう一度差し戻しても往復は増えない", async () => {
  const dir = await makeDir();
  await firstCompletion(dir);
  await openReviewRound({
    dir,
    runId: RUN_ID,
    taskBody: taskBody("差し戻し\n- 数え方が違う"),
    now: clock("2026-09-06T07:00:00.000Z"),
  });

  await openReviewRound({
    dir,
    runId: RUN_ID,
    taskBody: taskBody("差し戻し\n- 数え方が違う\n- 指摘を足した"),
    now: clock("2026-09-06T09:00:00.000Z"),
  });

  const saved = await loadReviewRun(dir, RUN_ID);

  assert.equal(saved?.rounds.length, 1);
  assert.deepEqual(saved?.rounds[0].notes, ["数え方が違う", "指摘を足した"]);
  // 開いた時刻は最初に差し戻したときのまま残す。
  assert.equal(saved?.rounds[0].openedAt, "2026-09-06T07:00:00.000Z");
});

test("修正回答が返った後の差し戻しは、次の往復として数える", async () => {
  const dir = await makeDir();
  await firstCompletion(dir);
  await openReviewRound({
    dir,
    runId: RUN_ID,
    taskBody: taskBody("差し戻し\n- 1回目の指摘"),
    now: clock("2026-09-06T07:00:00.000Z"),
  });
  await recordReviewReport({
    dir,
    runId: RUN_ID,
    taskPath: "docs/tasks/example.md",
    taskTitle: "例のタスク",
    mode: "development",
    report: "状態: 完了",
    now: clock("2026-09-06T08:00:00.000Z"),
  });

  await openReviewRound({
    dir,
    runId: RUN_ID,
    taskBody: taskBody("差し戻し\n- 2回目の指摘"),
    now: clock("2026-09-06T09:00:00.000Z"),
  });

  const saved = await loadReviewRun(dir, RUN_ID);

  assert.equal(saved?.rounds.length, 2);
  assert.equal(saved?.rounds[1].number, 2);
  assert.deepEqual(saved?.rounds[1].notes, ["2回目の指摘"]);
});

test("分析の依頼も同じ形で記録する", async () => {
  const dir = await makeDir();
  await recordReviewReport({
    dir,
    runId: RUN_ID,
    taskPath: "docs/tasks/review-2026-niigata-kinen.md",
    taskTitle: "新潟記念の振り返り",
    mode: "racing",
    report: "状態: 完了",
    now: clock("2026-09-06T06:00:00.000Z"),
  });

  assert.equal((await loadReviewRun(dir, RUN_ID))?.mode, "racing");
});
