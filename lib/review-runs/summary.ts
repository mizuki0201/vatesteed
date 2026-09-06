/**
 * 保存済みのレビュー記録を数える。
 *
 * **集計結果はファイルへ保存しない。** 画面はその都度ローカルのJSONを読んでここへ渡す
 * （docs/product.md の「画面」）。
 */

import type { ReviewRunMode, ReviewRunRecord } from "./record.ts";

/** 画面の並び順に使う、依頼の種類。 */
export const REVIEW_RUN_MODES: readonly ReviewRunMode[] = ["development", "racing"];

/** 依頼の種類の呼び方。実装と分析を画面で区別するために使う。 */
export const REVIEW_RUN_MODE_LABEL: Readonly<Record<ReviewRunMode, string>> = {
  development: "実装",
  racing: "分析",
};

export type ReviewRunSummary = {
  readonly runId: string;
  readonly taskPath: string;
  readonly taskTitle: string;
  readonly mode: ReviewRunMode;
  /** 差し戻して再開した回数 */
  readonly rounds: number;
  /** 全往復の指摘の合計 */
  readonly notes: number;
  /** まだ修正回答が返っていない往復の数 */
  readonly unanswered: number;
  readonly firstReportAt: string | null;
  readonly updatedAt: string;
};

export type ReviewRunTotals = {
  /** 記録が残っている依頼の数 */
  readonly requests: number;
  readonly rounds: number;
  readonly notes: number;
  /** 往復数ごとの依頼数。往復数の小さい順 */
  readonly distribution: readonly { readonly rounds: number; readonly requests: number }[];
  /** 依頼の種類ごとの依頼数と往復数 */
  readonly byMode: readonly {
    readonly mode: ReviewRunMode;
    readonly requests: number;
    readonly rounds: number;
  }[];
};

/**
 * 保存した時刻を、日本時間の「2026-09-06 15:30」の形にする。
 *
 * 記録は ISO 8601 で持ち、読むときだけ日本時間に直す。読めない値は空文字にして、画面を
 * 落とさない。
 */
export function formatReviewRunTime(value: string | null): string {
  if (value === null) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function summarizeReviewRun(record: ReviewRunRecord): ReviewRunSummary {
  return {
    runId: record.runId,
    taskPath: record.taskPath,
    taskTitle: record.taskTitle,
    mode: record.mode,
    rounds: record.rounds.length,
    notes: record.rounds.reduce((total, round) => total + round.notes.length, 0),
    unanswered: record.rounds.filter((round) => round.reply === null).length,
    firstReportAt: record.firstReportAt,
    updatedAt: record.updatedAt,
  };
}

export function summarizeReviewRuns(
  records: readonly ReviewRunRecord[],
): ReviewRunTotals {
  const summaries = records.map(summarizeReviewRun);
  const counts = new Map<number, number>();
  for (const summary of summaries) {
    counts.set(summary.rounds, (counts.get(summary.rounds) ?? 0) + 1);
  }

  return {
    requests: summaries.length,
    rounds: summaries.reduce((total, summary) => total + summary.rounds, 0),
    notes: summaries.reduce((total, summary) => total + summary.notes, 0),
    distribution: [...counts.entries()]
      .map(([rounds, requests]) => ({ rounds, requests }))
      .sort((left, right) => left.rounds - right.rounds),
    byMode: REVIEW_RUN_MODES.map((mode) => {
      const ofMode = summaries.filter((summary) => summary.mode === mode);

      return {
        mode,
        requests: ofMode.length,
        rounds: ofMode.reduce((total, summary) => total + summary.rounds, 0),
      };
    }),
  };
}
