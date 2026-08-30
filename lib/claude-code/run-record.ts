/**
 * Claude Code の実行記録。
 *
 * 1つの依頼を1つの Claude Code セッションで完了させるため、最初の実行で得た `session_id` を
 * ローカルに残し、中断や検証不合格のあとに同じセッションを再開できるようにする
 * （docs/claude-code-bridge.md の「実行の単位と再開」）。
 *
 * **依頼文全文、環境変数、認証情報、標準エラーの生ログは書かない。** 残すのは、再開と
 * 完了判定に要る値と、Claude が返した結果本文だけ。
 */

import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TaskMode } from "./task-file.ts";

/** 実行記録を置くディレクトリ（リポジトリからの相対）。gitignore 済み。 */
export const CLAUDE_RUNS_DIR = ".claude/runs";

/**
 * 実行記録の状態。
 *
 * `completed` は検証をすべて通ったときだけ。終了コードが0でも、検証に落ちていれば
 * `incomplete` のまま残す。
 */
export type ClaudeRunState = "running" | "completed" | "incomplete";

export type ClaudeRunRecord = {
  /** 実行記録のID。ファイル名にもなる */
  runId: string;
  /** Claude Code が返したセッションID。再開に使う。取れなければ null */
  sessionId: string | null;
  /** 実行するタスクMarkdown。接続確認ではnull */
  taskPath: string | null;
  /** タスクのモード。接続確認と旧形式の実行記録ではnull */
  mode: TaskMode | null;
  /** タスクで指定された実行役。接続確認と旧形式の実行記録ではnull */
  executorRole: string | null;
  state: ClaudeRunState;
  /** Claude Code プロセスの終了コード。シグナルで落ちたときは null */
  exitCode: number | null;
  /** Claude が返した `terminal_reason` */
  terminalReason: string | null;
  /** `modelUsage` から確認できた使用モデル */
  model: string | null;
  /** `subagent_stats.spawned`。実際に起動した子エージェント数 */
  subagentsSpawned: number | null;
  /** 未完了の理由。完了なら null */
  error: string | null;
  /** Claude が返した結果本文。未完了なら null */
  result: string | null;
  startedAt: string;
  updatedAt: string;
};

/**
 * 実行記録のID。
 *
 * ファイル名にそのまま使うので、区切り文字や上位ディレクトリを含む値を弾く。
 */
const RUN_ID_PATTERN = /^[0-9]{8}-[0-9]{6}-[0-9a-f]{8}$/;

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

/** 時刻順に並ぶIDを作る。同じ秒に2回実行しても衝突しないよう乱数を足す。 */
export function createRunId(now: Date = new Date(), suffix?: string): string {
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1, 2)}${pad(now.getDate(), 2)}`;
  const time = `${pad(now.getHours(), 2)}${pad(now.getMinutes(), 2)}${pad(now.getSeconds(), 2)}`;

  return `${date}-${time}-${suffix ?? randomBytes(4).toString("hex")}`;
}

/** 外から渡されたIDを、ファイル名として使う前に確かめる。 */
export function assertRunId(value: string): string {
  if (!RUN_ID_PATTERN.test(value)) {
    throw new Error(`実行記録のIDの形式が違います: ${JSON.stringify(value)}`);
  }

  return value;
}

export function runRecordPath(dir: string, runId: string): string {
  return path.join(dir, `${assertRunId(runId)}.json`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNullableString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error(`実行記録の ${key} が文字列ではありません。`);
  }

  return value;
}

function readNullableNumber(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`実行記録の ${key} が数値ではありません。`);
  }

  return value;
}

/** 保存済みの JSON を実行記録として読み直す。壊れていれば例外にする。 */
export function parseRunRecord(text: string): ClaudeRunRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("実行記録が JSON として読めません。");
  }

  if (!isRecord(parsed)) {
    throw new Error("実行記録が JSON のオブジェクトではありません。");
  }

  const runId = readNullableString(parsed, "runId");
  if (runId === null) {
    throw new Error("実行記録に runId がありません。");
  }

  const state = parsed.state;
  if (state !== "running" && state !== "completed" && state !== "incomplete") {
    throw new Error("実行記録の state が running、completed、incomplete のいずれでもありません。");
  }

  const modeValue = readNullableString(parsed, "mode");
  if (modeValue !== null && modeValue !== "development" && modeValue !== "racing") {
    throw new Error("実行記録の mode が不正です。");
  }

  return {
    runId: assertRunId(runId),
    sessionId: readNullableString(parsed, "sessionId"),
    taskPath: readNullableString(parsed, "taskPath"),
    mode: modeValue,
    executorRole: readNullableString(parsed, "executorRole"),
    state,
    exitCode: readNullableNumber(parsed, "exitCode"),
    terminalReason: readNullableString(parsed, "terminalReason"),
    model: readNullableString(parsed, "model"),
    subagentsSpawned: readNullableNumber(parsed, "subagentsSpawned"),
    error: readNullableString(parsed, "error"),
    result: readNullableString(parsed, "result"),
    startedAt: readNullableString(parsed, "startedAt") ?? "",
    updatedAt: readNullableString(parsed, "updatedAt") ?? "",
  };
}

/**
 * 実行記録を書く。
 *
 * 同じ名前の一時ファイルへ書いてから `rename` で置き換える。途中で落ちても、読み手が
 * 半分だけ書かれたファイルを読まないようにするため。
 */
export async function saveRunRecord(dir: string, record: ClaudeRunRecord): Promise<string> {
  const destination = runRecordPath(dir, record.runId);
  const temporary = `${destination}.${randomBytes(4).toString("hex")}.tmp`;

  await mkdir(dir, { recursive: true });
  await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  try {
    await rename(temporary, destination);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }

  return destination;
}

export async function loadRunRecord(dir: string, runId: string): Promise<ClaudeRunRecord> {
  const source = runRecordPath(dir, runId);

  let text: string;
  try {
    text = await readFile(source, "utf8");
  } catch {
    throw new Error(`実行記録が見つかりません: ${source}`);
  }

  return parseRunRecord(text);
}

/** 同じタスクMarkdownから作られた実行記録を新しい順で返す。 */
export async function findRunRecordsForTask(
  dir: string,
  taskPath: string,
): Promise<readonly ClaudeRunRecord[]> {
  const files = await readdir(dir).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const records: ClaudeRunRecord[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const runId = file.slice(0, -".json".length);
    const record = await loadRunRecord(dir, runId);
    if (record.taskPath === taskPath) records.push(record);
  }
  return records.sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

/**
 * Claude自体は正常終了していても、呼び出し側の完了判定に落ちたときに未完了へ戻す。
 * 次回は同じセッションを再開し、新規実行に切り替えない。
 */
export async function markRunIncomplete(
  dir: string,
  runId: string,
  error: string,
  now: () => Date = () => new Date(),
): Promise<ClaudeRunRecord> {
  const record = await loadRunRecord(dir, runId);
  if (record.state === "incomplete") return record;

  const incomplete: ClaudeRunRecord = {
    ...record,
    state: "incomplete",
    error,
    result: null,
    updatedAt: now().toISOString(),
  };
  await saveRunRecord(dir, incomplete);
  return incomplete;
}

/**
 * 再開してよい実行記録かを確かめ、再開に使うセッションIDを返す。
 *
 * **完了済みの記録は再開しない。** 再開できないときに新規実行へ黙って切り替えることも
 * しないので、ここでは例外を投げる。
 */
export function resumableSessionId(record: ClaudeRunRecord): string {
  if (record.state === "completed") {
    throw new Error(`実行記録 ${record.runId} は完了済みです。再開できません。`);
  }

  if (record.sessionId === null || record.sessionId === "") {
    throw new Error(
      `実行記録 ${record.runId} にセッションIDがありません。再開できません。`,
    );
  }

  return record.sessionId;
}
