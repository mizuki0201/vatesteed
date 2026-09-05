/**
 * 実行モードを子プロセスへ伝えるための環境変数。
 *
 * Codex から Claude Code へ渡す経路では、競馬について対話する依頼と Vatesteed 自体を作る
 * 依頼で、Claude Code に許す作業が違う（`docs/claude-code-bridge.md` の「実行の単位と再開」）。
 * 競馬の依頼では事実データの登録を Codex が済ませてから渡すため、Claude Code の側は分析結果
 * しか DB へ書かない。指示だけに頼らず実行時にも止められるよう、モードを環境変数で渡す。
 *
 * **これは事故を止めるためのもので、権限の仕組みではない。** 子プロセスは環境変数を自分で
 * 書き換えられる。
 */

/** 実行モードを伝える環境変数の名前。 */
export const AGENT_MODE_ENV = "VATESTEED_AGENT_MODE";

/** 競馬について対話する依頼を実行しているときの値。 */
export const RACING_AGENT_MODE = "racing";

/** タスクMarkdownの `mode` と同じ2つ。接続確認のように、どちらでもない実行では null。 */
export type AgentMode = "development" | "racing";

/**
 * 子プロセスへ足す環境変数を返す。
 *
 * **競馬モード以外では `undefined` を入れて、呼び出し元に残っていた値を消す。** Node の
 * `spawn` は値が `undefined` の項目を子プロセスへ渡さないので、これで前の実行の値を
 * 引き継がない。開発モードの実行が競馬モードの制限を受けるのを防ぐため。
 */
export function agentModeEnv(mode: AgentMode | null): Record<string, string | undefined> {
  return { [AGENT_MODE_ENV]: mode === "racing" ? RACING_AGENT_MODE : undefined };
}

/** 競馬モードとして動いているかを返す。 */
export function isRacingAgentMode(env: Record<string, string | undefined>): boolean {
  return env[AGENT_MODE_ENV] === RACING_AGENT_MODE;
}
