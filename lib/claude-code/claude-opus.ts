/** Codex から Claude Code を呼ぶときの固定引数。 */
export const CLAUDE_OPUS_BASE_ARGS = ["-p", "--model", "opus", "--output-format", "json"] as const;

/**
 * Claude Code を Opus 指定で非対話実行する引数を組み立てる。
 *
 * Phase 1 では、モデルを呼び出し元ごとに選ばせない。ここを通すことで
 * `claude -p` の既定モデルやローカル設定に引きずられない。
 */
export function buildClaudeOpusArgs(prompt: string): string[] {
  if (prompt.trim() === "") {
    throw new Error("Claude Code に渡す依頼文が空です。");
  }

  return [...CLAUDE_OPUS_BASE_ARGS, prompt];
}

/** `pnpm run` が残す区切りを除き、依頼文を1つだけ受け取る。 */
export function extractClaudePrompt(args: readonly string[]): string {
  const promptArgs = args[0] === "--" ? args.slice(1) : args;

  if (promptArgs.length !== 1) {
    throw new Error("使い方: pnpm claude:opus -- \"Claude Code への依頼文\"");
  }

  return promptArgs[0];
}
