/**
 * Claude Code の最終結果 JSON の検証。
 *
 * **終了コードだけを成功と見なさない。** 空の標準出力、利用枠エラー、JSON として読めない
 * 出力、別のモデル、子エージェントの起動を成功として扱わないため、ここで全部の条件を
 * 突き合わせる（docs/claude-code-bridge.md の「実行の単位と再開」）。
 *
 * 参照する項目名は `claude -p --output-format stream-json` が返す初期情報と最終結果のもの。
 */

/** 使用を許すモデル。これ以外が返ったら続行しない。 */
export const REQUIRED_MODEL_ID = "claude-opus-5";

/** 検証に落ちても、再開に使うためにセッションIDだけは拾っておく。 */
export type ClaudeResultFacts = {
  sessionId: string | null;
  terminalReason: string | null;
  model: string | null;
  subagentsSpawned: number | null;
};

export type ClaudeResultCheck =
  | ({ ok: true; sessionId: string; result: string } & ClaudeResultFacts)
  | ({ ok: false; reason: string } & ClaudeResultFacts);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit)}…`;
}

/**
 * `modelUsage` の中から Opus 5 の項目を探す。
 *
 * 項目名はモデルIDなので、日付などが後ろに付いた形も同じ Opus 5 として扱う。
 * Sonnet や Haiku は前方一致しないので通らない。
 */
function findRequiredModel(usage: unknown): string | null {
  if (!isRecord(usage)) return null;

  return Object.keys(usage).find((id) => id.startsWith(REQUIRED_MODEL_ID)) ?? null;
}

/**
 * 起動した子エージェント数を読む。
 *
 * `subagent_stats` は Agent ツールが動くまで付かないことがある。付いていない出力は
 * 「1つも起動していない」を意味するので0として扱う。値が付いているのに数値でない場合は
 * 判定できないので null を返し、検証で落とす。
 */
function readSpawned(stats: unknown): number | null {
  if (stats === undefined || stats === null) return 0;
  if (!isRecord(stats)) return null;

  const spawned = stats.spawned;

  return typeof spawned === "number" && Number.isFinite(spawned) ? spawned : null;
}

const NO_FACTS: ClaudeResultFacts = {
  sessionId: null,
  terminalReason: null,
  model: null,
  subagentsSpawned: null,
};

function parseOutputEvents(stdout: string): readonly Record<string, unknown>[] {
  const trimmed = stdout.trim();
  if (trimmed === "") return [];

  try {
    const single = JSON.parse(trimmed) as unknown;
    if (isRecord(single)) return [single];
  } catch {
    // stream-jsonは1行に1つのJSONを返すので、行ごとに読む。
  }

  return trimmed.split(/\r?\n/).map((line) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error("Claude のストリーム出力を JSON として読めなかった。");
    }
    if (!isRecord(parsed)) {
      throw new Error("Claude のストリーム出力に JSON オブジェクトではない行があった。");
    }
    return parsed;
  });
}

/** ストリームの途中で返されたセッションIDを取得する。 */
export function sessionIdFromClaudeOutput(stdout: string): string | null {
  for (const line of stdout.trim().split(/\r?\n/)) {
    try {
      const event = JSON.parse(line) as unknown;
      if (
        isRecord(event) &&
        typeof event.session_id === "string" &&
        event.session_id !== ""
      ) {
        return event.session_id;
      }
    } catch {
      // 最後の行がまだ受信途中でも、前の完全な行からセッションIDを保存する。
    }
  }
  return null;
}

/** 標準出力を検証する。成功条件を1つでも満たさなければ未完了として返す。 */
export function checkClaudeResult(stdout: string): ClaudeResultCheck {
  const trimmed = stdout.trim();
  if (trimmed === "") {
    return { ok: false, reason: "Claude の標準出力が空だった。", ...NO_FACTS };
  }

  let events: readonly Record<string, unknown>[];
  try {
    events = parseOutputEvents(trimmed);
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
      ...NO_FACTS,
    };
  }

  const parsed = [...events].reverse().find((event) => event.type === "result");
  if (parsed === undefined) {
    return { ok: false, reason: "Claude の出力に最終結果が無かった。", ...NO_FACTS };
  }

  const sessionId = sessionIdFromClaudeOutput(trimmed);
  const terminalReason = typeof parsed.terminal_reason === "string" ? parsed.terminal_reason : null;
  const model = findRequiredModel(parsed.modelUsage);
  const subagentsSpawned = readSpawned(parsed.subagent_stats);
  const facts: ClaudeResultFacts = { sessionId, terminalReason, model, subagentsSpawned };
  const fail = (reason: string): ClaudeResultCheck => ({ ok: false, reason, ...facts });

  if (parsed.is_error !== false) {
    const subtype = typeof parsed.subtype === "string" ? parsed.subtype : "不明";
    const errors = Array.isArray(parsed.errors)
      ? parsed.errors.filter((item): item is string => typeof item === "string").join(" / ")
      : "";
    const detail = errors === "" ? "" : `: ${truncate(errors, 300)}`;

    return fail(`Claude がエラーを返した（${subtype}）${detail}`);
  }

  if (terminalReason !== "completed") {
    return fail(`終了理由が completed ではなかった（${terminalReason ?? "項目なし"}）。`);
  }

  if (model === null) {
    return fail(`modelUsage に ${REQUIRED_MODEL_ID} が無かった。`);
  }

  if (subagentsSpawned === null) {
    return fail("subagent_stats.spawned を数値として読めなかった。");
  }

  if (subagentsSpawned !== 0) {
    return fail(`子エージェントが ${subagentsSpawned} 個起動された。`);
  }

  if (typeof parsed.result !== "string") {
    return fail("結果本文が文字列ではなかった。");
  }

  if (sessionId === null) {
    return fail("session_id が取れなかった。");
  }

  return { ...facts, ok: true, sessionId, result: parsed.result };
}
