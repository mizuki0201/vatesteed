/**
 * Codex が Claude Code へ差し戻した指摘と、返ってきた修正回答の記録。
 *
 * 改善のために一時的に使う記録なので DB へは入れず、`.claude/review-runs/<年月>/<実行記録のID>.json`
 * にローカルファイルとして置く（docs/claude-code-bridge.md の「レビューと修正回答の記録」）。
 * 書き込みと管理は Codex が使う入口の責務で、Claude Code 側には持たせない。
 *
 * **保存するのは、Codex の指摘、Claude Code の完了報告、集計に必要な識別子と時刻だけ。**
 * 認証情報、標準エラー、コマンド、ツールの出力は書かない。
 */

import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertRunId } from "../claude-code/index.ts";

/** レビュー記録を置くディレクトリ（リポジトリからの相対）。gitignore 済み。 */
export const REVIEW_RUNS_DIR = ".claude/review-runs";

/**
 * 依頼の種類。実装と分析を画面で区別するために持つ。
 *
 * 値はタスクMarkdownの `mode` と同じ。`lib/claude-code` から型を借りると、入口が
 * `lib/review-runs` を読み、`lib/review-runs` が `lib/claude-code` を読む循環になるため、
 * ここでは同じ形の型を自分で持つ。
 */
export type ReviewRunMode = "development" | "racing";

/** 差し戻し1回ぶん。Codex の指摘と、それに対する Claude Code の修正回答。 */
export type ReviewRound = {
  /** 1から始まる往復番号。手で書かず、保存時に付ける */
  readonly number: number;
  /** タスクMarkdownの「受け入れ結果」から読んだ指摘。1項目1件 */
  readonly notes: readonly string[];
  /** 差し戻して再開した時刻 */
  readonly openedAt: string;
  /** Claude Code が返した完了報告。まだ返っていなければ null */
  readonly reply: string | null;
  readonly repliedAt: string | null;
};

export type ReviewRunRecord = {
  /** 実行記録のID。`.claude/runs/` と同じ値で、ファイル名にもなる */
  readonly runId: string;
  readonly taskPath: string;
  readonly taskTitle: string;
  readonly mode: ReviewRunMode;
  /** 最初に正常完了したときの完了報告 */
  readonly firstReport: string | null;
  readonly firstReportAt: string | null;
  readonly rounds: readonly ReviewRound[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** 実行記録のIDから、置き場所の年月を決める。IDの先頭が実行日なので推測にならない。 */
export function reviewRunMonth(runId: string): string {
  const id = assertRunId(runId);

  return `${id.slice(0, 4)}-${id.slice(4, 6)}`;
}

/**
 * 1依頼ぶんの保存先。
 *
 * IDは `assertRunId` で確かめてから使う。URLから受け取った値で、ここより外のファイルを
 * 読めないようにするため。
 */
export function reviewRunPath(dir: string, runId: string): string {
  const id = assertRunId(runId);

  return path.join(dir, reviewRunMonth(id), `${id}.json`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== "string") {
    throw new Error(`レビュー記録の ${key} が文字列ではありません。`);
  }

  return value;
}

function readNullableString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (value === null || value === undefined) return null;

  return readString(source, key);
}

function parseRound(value: unknown, index: number): ReviewRound {
  if (!isRecord(value)) {
    throw new Error("レビュー記録の rounds に、オブジェクトではない要素があります。");
  }

  const number = value.number;
  if (typeof number !== "number" || number !== index + 1) {
    throw new Error("レビュー記録の rounds の往復番号が1から順に並んでいません。");
  }

  const notes = value.notes;
  if (!Array.isArray(notes) || notes.some((note) => typeof note !== "string")) {
    throw new Error("レビュー記録の notes が文字列の配列ではありません。");
  }

  return {
    number,
    notes: notes as readonly string[],
    openedAt: readString(value, "openedAt"),
    reply: readNullableString(value, "reply"),
    repliedAt: readNullableString(value, "repliedAt"),
  };
}

/** 保存済みの JSON をレビュー記録として読み直す。壊れていれば例外にする。 */
export function parseReviewRun(text: string): ReviewRunRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("レビュー記録が JSON として読めません。");
  }

  if (!isRecord(parsed)) {
    throw new Error("レビュー記録が JSON のオブジェクトではありません。");
  }

  const mode = readString(parsed, "mode");
  if (mode !== "development" && mode !== "racing") {
    throw new Error("レビュー記録の mode が不正です。");
  }

  const rounds = parsed.rounds;
  if (!Array.isArray(rounds)) {
    throw new Error("レビュー記録の rounds が配列ではありません。");
  }

  return {
    runId: assertRunId(readString(parsed, "runId")),
    taskPath: readString(parsed, "taskPath"),
    taskTitle: readString(parsed, "taskTitle"),
    mode,
    firstReport: readNullableString(parsed, "firstReport"),
    firstReportAt: readNullableString(parsed, "firstReportAt"),
    rounds: rounds.map(parseRound),
    createdAt: readString(parsed, "createdAt"),
    updatedAt: readString(parsed, "updatedAt"),
  };
}

/**
 * レビュー記録を書く。
 *
 * 一時ファイルへ書いてから `rename` で置き換える。保存の途中で終了しても、半分だけ
 * 書かれた JSON を残さないため（`lib/claude-code` の実行記録と同じ形）。
 */
export async function saveReviewRun(dir: string, record: ReviewRunRecord): Promise<string> {
  const destination = reviewRunPath(dir, record.runId);
  const temporary = `${destination}.${randomBytes(4).toString("hex")}.tmp`;

  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  try {
    await rename(temporary, destination);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }

  return destination;
}

/** 1依頼ぶんを読む。**まだ記録が無ければ null。** 過去分を推測で作らない。 */
export async function loadReviewRun(
  dir: string,
  runId: string,
): Promise<ReviewRunRecord | null> {
  const source = reviewRunPath(dir, runId);

  let text: string;
  try {
    text = await readFile(source, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }

  return parseReviewRun(text);
}

async function listMonths(dir: string): Promise<readonly string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    },
  );

  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

/** 保存済みの記録を、新しい順にすべて読む。集計結果は別ファイルへ保存しない。 */
export async function listReviewRuns(dir: string): Promise<readonly ReviewRunRecord[]> {
  const records: ReviewRunRecord[] = [];

  for (const month of await listMonths(dir)) {
    const files = await readdir(path.join(dir, month));
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const text = await readFile(path.join(dir, month, file), "utf8");
      records.push(parseReviewRun(text));
    }
  }

  return records.sort((left, right) => right.runId.localeCompare(left.runId));
}
