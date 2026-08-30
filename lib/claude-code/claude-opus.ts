/**
 * Claude Code を Opus 指定で非対話実行するための引数と、入口のコマンド解析。
 *
 * Phase 1 では、モデルを呼び出し元ごとに選ばせない。ここを通すことで `claude -p` の
 * 既定モデルやローカル設定に引きずられない。
 */

import { assertRunId } from "./run-record.ts";

/**
 * 固定で渡す引数。
 *
 * `--disallowedTools Agent` で子エージェントを物理的に禁止する。既定では子エージェントを
 * 起動しない、という決定（docs/agent-design.md の「実行資源の上限」）を、指示だけでなく
 * 起動時の引数でも守るため。
 *
 * **`--disallowedTools` は値を複数取るので、直後に依頼文を置かない。** 置くと依頼文まで
 * ツール名として読まれる。後ろには必ず別のオプションが来る並びにしてある。
 */
export const CLAUDE_OPUS_BASE_ARGS = [
  "-p",
  "--disallowedTools",
  "Agent",
  "--model",
  "opus",
  "--output-format",
  "stream-json",
  "--verbose",
] as const;

/**
 * 子プロセスに固定で渡す環境変数。
 *
 * ツール呼び出しの同時数は2を超えないようにする。呼び出し元の環境に別の値が入っていても
 * ここで上書きする。
 */
export const CLAUDE_CHILD_ENV: Readonly<Record<string, string>> = {
  CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY: "2",
};

export type ClaudeOpusArgsInput = {
  prompt: string;
  /** 再開するときだけ渡す。Claude Code が返したセッションID */
  resumeSessionId?: string | null;
};

/** Claude Code を起動する引数を組み立てる。 */
export function buildClaudeOpusArgs({
  prompt,
  resumeSessionId = null,
}: ClaudeOpusArgsInput): string[] {
  if (prompt.trim() === "") {
    throw new Error("Claude Code に渡す依頼文が空です。");
  }

  if (resumeSessionId !== null && resumeSessionId.trim() === "") {
    throw new Error("再開するセッションIDが空です。");
  }

  const resumeArgs = resumeSessionId === null ? [] : ["--resume", resumeSessionId];

  return [...CLAUDE_OPUS_BASE_ARGS, ...resumeArgs, prompt];
}

/** コマンドラインから受け取る操作。依頼本文は受け取らず、タスクMarkdownだけを受け取る。 */
export type ClaudeCliCommand =
  | { kind: "check-auth" }
  | { kind: "new"; taskPath: string }
  | { kind: "restart"; taskPath: string }
  | { kind: "resume"; runId: string; taskPath: string };

/** 検証済みのタスクから組み立てた、実行処理へ渡す値。 */
export type ClaudeCommand =
  | {
      kind: "check-auth";
      prompt: string;
      taskPath: null;
      mode: null;
      executorRole: null;
    }
  | {
      kind: "new";
      prompt: string;
      taskPath: string;
      mode: "development" | "racing";
      executorRole: string;
    }
  | {
      kind: "resume";
      runId: string;
      prompt: string;
      taskPath: string;
      mode: "development" | "racing";
      executorRole: string;
    };

const USAGE = [
  "使い方:",
  "  pnpm claude:opus -- --check-auth",
  "  pnpm claude:opus -- --task docs/tasks/<タスク名>.md",
  "  pnpm claude:opus -- --resume <実行記録のID> --task docs/tasks/<タスク名>.md",
  "  pnpm claude:opus -- --restart --task docs/tasks/<タスク名>.md",
].join("\n");

/**
 * `pnpm run` が残す区切りを除き、新規実行か再開かを見分ける。
 *
 * **再開できないときに新規実行へ切り替えない。** 形式が合わなければ例外にする。
 */
export function parseClaudeCommand(argv: readonly string[]): ClaudeCliCommand {
  const args = argv[0] === "--" ? argv.slice(1) : argv;

  if (args.length === 1 && args[0] === "--check-auth") {
    return { kind: "check-auth" };
  }

  if (args[0] === "--resume" || args[0] === "-r") {
    const runId = args[1] ?? "";
    if (runId === "" || args[2] !== "--task" || args.length !== 4) {
      throw new Error(USAGE);
    }

    return { kind: "resume", runId: assertRunId(runId), taskPath: args[3] };
  }

  if (args[0] === "--task" && args.length === 2) {
    return { kind: "new", taskPath: args[1] };
  }

  if (args[0] === "--restart" && args[1] === "--task" && args.length === 3) {
    return { kind: "restart", taskPath: args[2] };
  }

  throw new Error(USAGE);
}
