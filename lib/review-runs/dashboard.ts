/**
 * 管理画面へレビュー記録を出すための取得。
 *
 * **画面側で隠すだけにせず、ここでも owner だけに絞る。** 画面に書き忘れても中身が
 * 出ないようにするため（docs/architecture.md の「アクセス制御」）。
 */

import path from "node:path";
import {
  listReviewRuns,
  loadReviewRun,
  REVIEW_RUNS_DIR,
  type ReviewRunRecord,
} from "./record.ts";
import {
  summarizeReviewRun,
  summarizeReviewRuns,
  type ReviewRunSummary,
  type ReviewRunTotals,
} from "./summary.ts";

/**
 * owner だけに見せる。
 *
 * `assertCan` は Next のランタイムに依存する。このディレクトリは Claude Code の入口
 * （Next を持たないただの Node プロセス）からも読むので、**呼ばれたときにだけ読み込む。**
 */
async function assertOwner(): Promise<void> {
  const { assertCan } = await import("../access/index.ts");

  await assertCan("claude.reviews");
}

/**
 * ローカルの記録を読める場所かどうか。
 *
 * 記録はローカルファイルなので Vercel のデプロイ先からは読めない。読みに行かず、
 * ローカルでだけ確認できることを画面に出す（docs/product.md の「画面」）。
 */
export function canReadLocalReviewRuns(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.VERCEL !== "1";
}

function reviewRunsDir(): string {
  // ローカルの記録をデプロイ先の出力へ含めない。Vercel では読まないので、追跡させる必要も無い。
  return path.join(/*turbopackIgnore: true*/ process.cwd(), REVIEW_RUNS_DIR);
}

export type ReviewRunsView = {
  /** ローカルの記録を読んだかどうか。false ならデプロイ先で見ている */
  readonly local: boolean;
  readonly runs: readonly ReviewRunSummary[];
  readonly totals: ReviewRunTotals;
};

/** 一覧の画面が使う。保存済みのJSONをその都度読んで数える。 */
export async function getReviewRunsView(): Promise<ReviewRunsView> {
  await assertOwner();

  if (!canReadLocalReviewRuns()) {
    return { local: false, runs: [], totals: summarizeReviewRuns([]) };
  }

  const records = await listReviewRuns(reviewRunsDir());

  return {
    local: true,
    runs: records.map(summarizeReviewRun),
    totals: summarizeReviewRuns(records),
  };
}

export type ReviewRunDetail = {
  readonly local: boolean;
  readonly record: ReviewRunRecord | null;
};

/** 詳細の画面が使う。IDの形が違えば読みに行かない。 */
export async function getReviewRunDetail(runId: string): Promise<ReviewRunDetail> {
  await assertOwner();

  if (!canReadLocalReviewRuns()) return { local: false, record: null };

  try {
    return { local: true, record: await loadReviewRun(reviewRunsDir(), runId) };
  } catch {
    // URLに実行記録のIDでない値が入っていた場合。読めるファイルを探しに行かず、無いものとして返す。
    return { local: true, record: null };
  }
}
