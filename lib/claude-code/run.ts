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
import { acquireTaskLock, taskLocksDir } from "./task-lock.ts";

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
  /** タスク単位のロックを置くディレクトリ。既定は実行記録のディレクトリの隣 */
  locksDir?: string;
  runProcess: ClaudeProcessRunner;
  /** 子プロセスに渡す環境変数のもと。既定は呼び出し元の環境 */
  env?: Record<string, string | undefined>;
  now?: () => Date;
  /** Codexの確認後に差し戻すときだけ、正常終了した同じセッションを再開可能へ戻す。 */
  reopenCompleted?: boolean;
  /** 本人が最初からやり直すよう明示したときだけ、同じタスクの新規実行を許す。 */
  allowExistingTaskRun?: boolean;
  /** ロックの持ち主がまだ動いているかの確認。テストで差し込む */
  isProcessAlive?: (pid: number) => boolean;
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
 *
 * **同じタスクの実行は同時に1つだけ。** タスク単位のロックを先に取り、取れなければ新規実行も
 * 再開も `--restart` も行わない（docs/claude-code-bridge.md の「実行の単位と再開」）。
 */
export async function runClaudeOpus(options: RunClaudeOpusOptions): Promise<ClaudeRunOutput> {
  const { command, runsDir, locksDir = taskLocksDir(runsDir), now, isProcessAlive } = options;

  // 接続確認にはタスクMarkdownが無いので、ロックを取る対象も無い。
  if (command.taskPath === null) return runLocked(options, null);

  const lock = await acquireTaskLock({
    dir: locksDir,
    taskPath: command.taskPath,
    now,
    isProcessAlive,
  });
  try {
    return await runLocked(options, lock.reclaimedFrom);
  } finally {
    await lock.release();
  }
}

/**
 * ロックを取った状態で1回ぶんを実行する。
 *
 * `reclaimedFrom` が入っているのは、前回の入口が異常終了してロックが残っていた場合。その
 * プロセスが存在しないことは確認済みなので、`running` のまま残った実行記録を未完了へ戻す。
 * 戻さないと、そのタスクは再開もできなくなる。
 */
async function runLocked(
  {
    command,
    runsDir,
    runProcess,
    env = process.env,
    now = () => new Date(),
    reopenCompleted = false,
    allowExistingTaskRun = false,
  }: RunClaudeOpusOptions,
  reclaimedFrom: number | null,
): Promise<ClaudeRunOutput> {
  const startedAt = now().toISOString();

  if (command.taskPath !== null) {
    const records = await findRunRecordsForTask(runsDir, command.taskPath);
    const running = records.filter((record) => record.state === "running");

    if (reclaimedFrom !== null) {
      for (const record of running) {
        await markRunIncomplete(
          runsDir,
          record.runId,
          `前回の実行（プロセス ${reclaimedFrom}）が実行記録を running のまま終了した。`,
          now,
        );
      }
    } else if (running[0] !== undefined) {
      throw new Error(
        `タスク ${command.taskPath} は実行記録 ${running[0].runId} が実行中です。終わるまで新規実行も再開もできません。`,
      );
    }

    if (command.kind === "new" && !allowExistingTaskRun && records[0] !== undefined) {
      throw new Error(
        `タスク ${command.taskPath} には実行記録 ${records[0].runId} があります。新規実行せず、同じ実行記録を再開してください。`,
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
