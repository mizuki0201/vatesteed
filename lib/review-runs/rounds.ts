/**
 * レビュー記録の書き込み。Codex が使う Claude Code の入口だけが呼ぶ。
 *
 * 数えるのは、**正常完了した実行を Codex が差し戻して再開した回数**だけ。最初の実装・分析と、
 * 利用上限・APIエラー・中断からの再開は往復に含めない（docs/claude-code-bridge.md の
 * 「レビューと修正回答の記録」）。
 */

import { parseSendBackNotes } from "./notes.ts";
import {
  loadReviewRun,
  type ReviewRunMode,
  type ReviewRunRecord,
  saveReviewRun,
} from "./record.ts";

export type OpenReviewRoundInput = {
  readonly dir: string;
  readonly runId: string;
  /** タスクMarkdownの本文。「受け入れ結果」から指摘を読む */
  readonly taskBody: string;
  readonly now?: () => Date;
};

/**
 * 差し戻しを1件ぶん記録する。Claude Code を起動する前に呼ぶ。
 *
 * **記録がまだ無ければ何もしない。** この仕組みを入れる前の実行を、往復の途中から推測で
 * 作り始めないため。
 *
 * 差し戻した後の実行が途中で止まり、もう一度再開したときは、開いたままの往復の指摘を
 * 書き直すだけで新しい往復を増やさない。
 */
export async function openReviewRound(
  input: OpenReviewRoundInput,
): Promise<ReviewRunRecord | null> {
  const { dir, runId, taskBody, now = () => new Date() } = input;
  const notes = parseSendBackNotes(taskBody);
  const record = await loadReviewRun(dir, runId);
  if (record === null) return null;

  const at = now().toISOString();
  const last = record.rounds.at(-1);
  const rounds =
    last !== undefined && last.reply === null
      ? [...record.rounds.slice(0, -1), { ...last, notes }]
      : [
          ...record.rounds,
          { number: record.rounds.length + 1, notes, openedAt: at, reply: null, repliedAt: null },
        ];

  const updated: ReviewRunRecord = { ...record, rounds, updatedAt: at };
  await saveReviewRun(dir, updated);

  return updated;
}

export type RecordReviewReportInput = {
  readonly dir: string;
  readonly runId: string;
  readonly taskPath: string;
  readonly taskTitle: string;
  readonly mode: ReviewRunMode;
  /** Claude Code が返した完了報告 */
  readonly report: string;
  readonly now?: () => Date;
};

/**
 * Claude Code の正常な完了報告を記録する。
 *
 * まだ記録が無ければ、最初の完了報告として1依頼ぶんのファイルを作る。開いたままの往復が
 * あれば、その往復の修正回答として保存する。
 */
export async function recordReviewReport(
  input: RecordReviewReportInput,
): Promise<ReviewRunRecord> {
  const { dir, runId, taskPath, taskTitle, mode, report, now = () => new Date() } = input;
  const at = now().toISOString();
  const record = await loadReviewRun(dir, runId);

  if (record === null) {
    const created: ReviewRunRecord = {
      runId,
      taskPath,
      taskTitle,
      mode,
      firstReport: report,
      firstReportAt: at,
      rounds: [],
      createdAt: at,
      updatedAt: at,
    };
    await saveReviewRun(dir, created);

    return created;
  }

  const last = record.rounds.at(-1);
  const updated: ReviewRunRecord =
    last !== undefined && last.reply === null
      ? {
          ...record,
          rounds: [...record.rounds.slice(0, -1), { ...last, reply: report, repliedAt: at }],
          updatedAt: at,
        }
      : record.firstReport === null
        ? { ...record, firstReport: report, firstReportAt: at, updatedAt: at }
        : record;

  if (updated !== record) await saveReviewRun(dir, updated);

  return updated;
}
