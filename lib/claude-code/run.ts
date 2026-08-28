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
import { checkClaudeResult } from "./result.ts";
import {
  type ClaudeRunRecord,
  createRunId,
  loadRunRecord,
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
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
}: RunClaudeOpusOptions): Promise<ClaudeRunOutput> {
  const startedAt = now().toISOString();

  const previous =
    command.kind === "resume" ? await loadRunRecord(runsDir, command.runId) : null;
  const resumeSessionId = previous === null ? null : resumableSessionId(previous);
  const runId = previous === null ? createRunId(now()) : previous.runId;

  const args = buildClaudeOpusArgs({ prompt: command.prompt, resumeSessionId });

  let outcome: ClaudeProcessOutcome;
  try {
    outcome = await runProcess({ args, env: { ...env, ...CLAUDE_CHILD_ENV } });
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

  const record: ClaudeRunRecord = {
    runId,
    sessionId: check.sessionId ?? resumeSessionId,
    state: ok ? "completed" : "incomplete",
    exitCode: outcome.exitCode,
    terminalReason: check.terminalReason,
    model: check.model,
    subagentsSpawned: check.subagentsSpawned,
    error: reason,
    result: check.ok ? check.result : null,
    startedAt: previous?.startedAt ?? startedAt,
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
