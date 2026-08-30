/**
 * Claude Code の1回の実行（新規または再開）をまとめる。
 *
 * 子プロセスの起動そのものは呼び出し元から差し込む。実際に Claude を呼ばずに、引数の
 * 組み立て・検証・実行記録の書き込みを試せるようにするため。
 */

import {
  buildClaudeOpusArgs,
  CLAUDE_CHILD_ENV,
  type ClaudeCommand,
} from "./claude-opus.ts";
import { checkClaudeResult, sessionIdFromClaudeOutput } from "./result.ts";
import {
  type ClaudeRunRecord,
  createRunId,
  findRunRecordsForTask,
  loadRunRecord,
  markRunIncomplete,
  resumableSessionId,
  saveRunRecord,
} from "./run-record.ts";

export type ClaudeProcessOutcome = {
  /** シグナルで落ちたときは null */
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type ClaudeProcessInput = {
  args: string[];
  env: Record<string, string | undefined>;
  /** stream-jsonを受け取るたびに呼ぶ。セッションIDを終了前に保存するために使う。 */
  onStdoutChunk?: (chunk: string) => Promise<void>;
};

export type ClaudeProcessRunner = (input: ClaudeProcessInput) => Promise<ClaudeProcessOutcome>;

/**
 * 入口が最後に出す JSON。
 *
 * 成功でも失敗でも同じ形にする。失敗のときも実行記録IDと未完了の理由が入る。
 * 標準エラーは、実行記録にも標準出力にも出さない。
 */
export type ClaudeRunOutput = {
  ok: boolean;
  run: ClaudeRunRecord;
  result: string | null;
  error: string | null;
};

export type RunClaudeOpusOptions = {
  command: ClaudeCommand;
  /** 実行記録を置くディレクトリ */
  runsDir: string;
  runProcess: ClaudeProcessRunner;
  /** 子プロセスに渡す環境変数のもと。既定は呼び出し元の環境 */
  env?: Record<string, string | undefined>;
  now?: () => Date;
  /** Codexの確認後に差し戻すときだけ、正常終了した同じセッションを再開可能へ戻す。 */
  reopenCompleted?: boolean;
  /** 本人が最初からやり直すよう明示したときだけ、同じタスクの新規実行を許す。 */
  allowExistingTaskRun?: boolean;
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertSameTask(previous: ClaudeRunRecord, command: ClaudeCommand): void {
  if (command.kind !== "resume") return;
  const pairs = [
    ["taskPath", previous.taskPath, command.taskPath],
    ["mode", previous.mode, command.mode],
    ["executorRole", previous.executorRole, command.executorRole],
  ] as const;
  for (const [key, saved, received] of pairs) {
    if (saved !== null && saved !== received) {
      throw new Error(`実行記録の ${key} と指定されたタスクが一致しません。`);
    }
  }
}

/**
 * 1回の実行を行い、実行記録を残す。
 *
 * 再開できない実行記録を渡されたときは例外にする。**新規実行へ黙って切り替えない。**
 */
export async function runClaudeOpus({
  command,
  runsDir,
  runProcess,
  env = process.env,
  now = () => new Date(),
  reopenCompleted = false,
  allowExistingTaskRun = false,
}: RunClaudeOpusOptions): Promise<ClaudeRunOutput> {
  const startedAt = now().toISOString();

  if (command.kind === "new" && !allowExistingTaskRun) {
    const [existing] = await findRunRecordsForTask(runsDir, command.taskPath);
    if (existing !== undefined) {
      throw new Error(
        `タスク ${command.taskPath} には実行記録 ${existing.runId} があります。新規実行せず、同じ実行記録を再開してください。`,
      );
    }
  }

  let previous =
    command.kind === "resume" ? await loadRunRecord(runsDir, command.runId) : null;
  if (previous !== null) assertSameTask(previous, command);
  if (previous?.state === "completed" && reopenCompleted) {
    previous = await markRunIncomplete(
      runsDir,
      previous.runId,
      "タスクの完了条件を満たしていないため、同じClaude Codeセッションを再開する。",
      now,
    );
  }
  const resumeSessionId = previous === null ? null : resumableSessionId(previous);
  const runId = previous === null ? createRunId(now()) : previous.runId;

  const args = buildClaudeOpusArgs({ prompt: command.prompt, resumeSessionId });
  let record: ClaudeRunRecord = {
    runId,
    sessionId: resumeSessionId,
    taskPath: command.taskPath,
    mode: command.mode,
    executorRole: command.executorRole,
    state: "running",
    exitCode: null,
    terminalReason: null,
    model: null,
    subagentsSpawned: null,
    error: null,
    result: null,
    startedAt: previous?.startedAt ?? startedAt,
    updatedAt: now().toISOString(),
  };
  await saveRunRecord(runsDir, record);

  let streamedStdout = "";
  const saveStreamSessionId = async (chunk: string): Promise<void> => {
    streamedStdout += chunk;
    const sessionId = sessionIdFromClaudeOutput(streamedStdout);
    if (sessionId === null || sessionId === record.sessionId) return;
    record = { ...record, sessionId, updatedAt: now().toISOString() };
    await saveRunRecord(runsDir, record);
  };

  let outcome: ClaudeProcessOutcome;
  try {
    outcome = await runProcess({
      args,
      env: { ...env, ...CLAUDE_CHILD_ENV },
      onStdoutChunk: saveStreamSessionId,
    });
  } catch (error) {
    outcome = { exitCode: null, stdout: "", stderr: messageOf(error) };
  }

  const check = checkClaudeResult(outcome.stdout);
  const exitFailed = outcome.exitCode !== 0;
  const reason = !check.ok
    ? check.reason
    : exitFailed
      ? `Claude の終了コードが 0 ではなかった（${outcome.exitCode ?? "シグナルで終了"}）。`
      : null;
  const ok = reason === null;

  record = {
    ...record,
    sessionId: check.sessionId ?? record.sessionId,
    state: ok ? "completed" : "incomplete",
    exitCode: outcome.exitCode,
    terminalReason: check.terminalReason,
    model: check.model,
    subagentsSpawned: check.subagentsSpawned,
    error: reason,
    result: check.ok ? check.result : null,
    updatedAt: now().toISOString(),
  };

  await saveRunRecord(runsDir, record);

  return {
    ok,
    run: record,
    result: record.result,
    error: reason,
  };
}
