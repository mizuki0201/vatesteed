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
  "json",
] as const;

/**
 * 往復数の上限。
 *
 * 上限に達したときは結果を捨てず、実行記録を残して同じセッションから再開する。
 * ここは実行資源の上限であって、分析の深さ（精査する過去の出走数や1組の馬の数）とは
 * 別のもの。**依頼ごとに変わる値をここに埋め込まない。**
 */
export const CLAUDE_MAX_TURNS = 24;

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

  return [
    ...CLAUDE_OPUS_BASE_ARGS,
    ...resumeArgs,
    "--max-turns",
    String(CLAUDE_MAX_TURNS),
    prompt,
  ];
}

/** 入口が受け取れるコマンド。 */
export type ClaudeCommand =
  | { kind: "new"; prompt: string }
  | { kind: "resume"; runId: string; prompt: string };

const USAGE = [
  "使い方:",
  '  pnpm claude:opus -- "Claude Code への依頼文"',
  '  pnpm claude:opus -- --resume <実行記録のID> -- "続きの依頼文"',
].join("\n");

/**
 * `pnpm run` が残す区切りを除き、新規実行か再開かを見分ける。
 *
 * **再開できないときに新規実行へ切り替えない。** 形式が合わなければ例外にする。
 */
export function parseClaudeCommand(argv: readonly string[]): ClaudeCommand {
  const args = argv[0] === "--" ? argv.slice(1) : argv;

  if (args[0] === "--resume" || args[0] === "-r") {
    const runId = args[1] ?? "";
    const promptArgs = args[2] === "--" ? args.slice(3) : args.slice(2);

    if (runId === "" || promptArgs.length !== 1) {
      throw new Error(USAGE);
    }

    return { kind: "resume", runId: assertRunId(runId), prompt: promptArgs[0] };
  }

  if (args.length !== 1) {
    throw new Error(USAGE);
  }

  return { kind: "new", prompt: args[0] };
}
