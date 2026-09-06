import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReviewRound, ReviewRunMode, ReviewRunRecord } from "./record.ts";
import {
  formatReviewRunTime,
  summarizeReviewRun,
  summarizeReviewRuns,
} from "./summary.ts";

function round(number: number, notes: readonly string[], reply: string | null): ReviewRound {
  return {
    number,
    notes,
    openedAt: "2026-09-06T07:00:00.000Z",
    reply,
    repliedAt: reply === null ? null : "2026-09-06T08:00:00.000Z",
  };
}

function record(
  runId: string,
  mode: ReviewRunMode,
  rounds: readonly ReviewRound[],
): ReviewRunRecord {
  return {
    runId,
    taskPath: "docs/tasks/example.md",
    taskTitle: "例のタスク",
    mode,
    firstReport: "状態: 完了",
    firstReportAt: "2026-09-06T06:00:00.000Z",
    rounds,
    createdAt: "2026-09-06T06:00:00.000Z",
    updatedAt: "2026-09-06T08:00:00.000Z",
  };
}

test("1依頼ぶんの往復数・指摘数・回答待ちを数える", () => {
  const summary = summarizeReviewRun(
    record("20260906-153206-9fd2dc6c", "development", [
      round(1, ["指摘A", "指摘B"], "状態: 完了"),
      round(2, ["指摘C"], null),
    ]),
  );

  assert.equal(summary.rounds, 2);
  assert.equal(summary.notes, 3);
  assert.equal(summary.unanswered, 1);
  assert.equal(summary.mode, "development");
});

test("依頼数・往復数・指摘数をまとめて数える", () => {
  const totals = summarizeReviewRuns([
    record("20260906-153206-9fd2dc6c", "development", [round(1, ["指摘A"], "状態: 完了")]),
    record("20260906-160000-aaaaaaaa", "development", []),
    record("20260905-120000-bbbbbbbb", "racing", [
      round(1, ["指摘B", "指摘C"], "状態: 完了"),
      round(2, ["指摘D"], null),
    ]),
  ]);

  assert.equal(totals.requests, 3);
  assert.equal(totals.rounds, 3);
  assert.equal(totals.notes, 4);
});

test("往復数の分布を、往復数の小さい順に返す", () => {
  const totals = summarizeReviewRuns([
    record("20260906-153206-9fd2dc6c", "development", [round(1, [], null)]),
    record("20260906-160000-aaaaaaaa", "development", []),
    record("20260905-120000-bbbbbbbb", "racing", [round(1, [], null)]),
  ]);

  assert.deepEqual(totals.distribution, [
    { rounds: 0, requests: 1 },
    { rounds: 1, requests: 2 },
  ]);
});

test("実装と分析を分けて数える", () => {
  const totals = summarizeReviewRuns([
    record("20260906-153206-9fd2dc6c", "development", [round(1, ["指摘A"], null)]),
    record("20260905-120000-bbbbbbbb", "racing", []),
  ]);

  assert.deepEqual(totals.byMode, [
    { mode: "development", requests: 1, rounds: 1 },
    { mode: "racing", requests: 1, rounds: 0 },
  ]);
});

test("記録が1件も無ければ、すべて0で返す", () => {
  const totals = summarizeReviewRuns([]);

  assert.equal(totals.requests, 0);
  assert.equal(totals.rounds, 0);
  assert.equal(totals.notes, 0);
  assert.deepEqual(totals.distribution, []);
});

test("保存した時刻を日本時間で読む", () => {
  assert.equal(formatReviewRunTime("2026-09-06T06:30:12.000Z"), "2026-09-06 15:30");
  assert.equal(formatReviewRunTime(null), "");
  assert.equal(formatReviewRunTime("時刻ではない"), "");
});
