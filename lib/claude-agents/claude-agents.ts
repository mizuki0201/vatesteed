/**
 * eve の `agent/subagents/<id>/` から、Claude Code が読む `.claude/agents/<id>.md` を
 * 組み立てる。
 *
 * Phase 1 のエンジンは Claude Code だが、役の実体は eve の規約どおり
 * `agent/subagents/` に置いている。Claude Code が読むのは `.claude/agents/` 配下の
 * markdown なので、そこへ写す必要がある。手で両方に書くと必ずズレるため、
 * eve 側だけを正本にして機械的に写す。
 *
 * ファイルを読み書きするのは sync.ts。ここには組み立てだけを置く。
 */

/** 生成物の先頭に入れる、手で編集しないための断り書き。 */
const GENERATED_NOTICE =
  "# このファイルは自動生成される。手で編集しても pnpm gen:agents で上書きされる。";

/** 正本の場所を生成物に書き添えるための文言を作る。 */
function sourceNotice(id: string): string {
  return `# 正本は agent/subagents/${id}/`;
}

/**
 * YAML のスカラーとして安全な形に包む。
 *
 * description には日本語の記号（「：」「#」など）が入りうる。素で置くと YAML の
 * 構文に食われるため、常に二重引用符で包んでエスケープする。
 */
export function quoteYamlString(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/**
 * `agent.ts` のソースから `description` を取り出す。
 *
 * eve の `defineAgent` は渡した定義をそのまま返すので、モジュールを import しても
 * 読める。ただし import すると eve 本体の読み込みが走るため、編集のたびに動く用途では
 * ソースから読む方が速い。**`description` は1行で書く**前提。
 */
export function extractDescription(agentSource: string): string | undefined {
  const match = agentSource.match(/description:\s*"((?:[^"\\]|\\.)*)"/);
  if (!match) return undefined;
  return match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

/**
 * Phase 1 限りの手段を足す役かどうかを判定する。
 *
 * `pnpm db:query` のような Phase 1 限りの手段は、役の `instructions.md`（Phase 3 で
 * そのまま eve のプロンプトになる）ではなくブリッジ側に置き、生成のときに足している。
 * Phase 3 ではこのブリッジごと捨てれば後始末が終わる。
 *
 * 足さないのは `dev-` で始まる開発の役。DB を触らないため。
 */
export function needsPhase1DbAccess(id: string): boolean {
  return !id.startsWith("dev-");
}

/**
 * Claude Code のサブエージェント定義（frontmatter + 本文）を組み立てる。
 *
 * `name` と `description` が Claude Code の必須項目。`model` は書かない
 * （既定の `inherit` に任せる。eve 側は `agent.ts` の `model` を使う）。
 *
 * `appendix` を渡すと本文の末尾に空行を1つ挟んで足す。正本の `instructions.md` に
 * 書きたくない、Claude Code 向けの補足をここから入れる。
 *
 * 末尾は `appendix` の有無によらず改行1つで閉じる。正本の末尾の空行の数で生成物が
 * 変わらないようにするため。
 */
export function buildAgentMarkdown(input: {
  readonly id: string;
  readonly description: string;
  readonly body: string;
  readonly appendix?: string;
}): string {
  const frontmatter = [
    "---",
    GENERATED_NOTICE,
    sourceNotice(input.id),
    `name: ${input.id}`,
    `description: ${quoteYamlString(input.description)}`,
    "---",
  ].join("\n");

  const body =
    input.appendix === undefined
      ? input.body.trim()
      : `${input.body.trim()}\n\n${input.appendix.trim()}`;

  return `${frontmatter}\n\n${body}\n`;
}
