/**
 * Claude Code のストリーム出力から、進行確認に使う要約だけを取り出す。
 *
 * **本文、思考、コマンド、ツール結果、標準エラー、認証情報は取り出さない。** 残すのは、
 * 最後に活動した時刻、受け取ったイベント数、直近の活動の種類、ツール実行ならツール名だけ
 * （docs/claude-code-bridge.md の「Claude Code と Codex の引き継ぎ」）。
 */

/** 直近の活動の種類。 */
export type ClaudeActivityKind = "startup" | "text" | "tool_use" | "tool_result" | "result";

const ACTIVITY_KINDS: readonly ClaudeActivityKind[] = [
  "startup",
  "text",
  "tool_use",
  "tool_result",
  "result",
];

/** 進捗表示に使う日本語の名前。 */
export const ACTIVITY_LABEL: Readonly<Record<ClaudeActivityKind, string>> = {
  startup: "起動",
  text: "文章生成",
  tool_use: "ツール実行",
  tool_result: "ツール結果",
  result: "最終結果",
};

export function isClaudeActivityKind(value: unknown): value is ClaudeActivityKind {
  return typeof value === "string" && ACTIVITY_KINDS.includes(value as ClaudeActivityKind);
}

export type ClaudeActivity = {
  /** 受け取ったイベント数 */
  eventCount: number;
  /** 直近の活動。種類を判定できるイベントがまだ無ければ null */
  kind: ClaudeActivityKind | null;
  /** ツール実行なら、そのツール名。それ以外は null */
  toolName: string | null;
  /** ストリームの途中で返されたセッションID */
  sessionId: string | null;
};

export type ClaudeActivityTracker = {
  /**
   * 受け取った断片を足し、要約が変わったら新しい要約を返す。変わらなければ null。
   *
   * 断片は行の途中で切れることがあるので、改行までそろった行だけを読む。
   */
  push: (chunk: string) => ClaudeActivity | null;
  snapshot: () => ClaudeActivity;
};

/** ツール名が長すぎたり改行を含んだりしても、進捗表示が崩れないようにする。 */
const TOOL_NAME_LIMIT = 60;

const EMPTY_ACTIVITY: ClaudeActivity = {
  eventCount: 0,
  kind: null,
  toolName: null,
  sessionId: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeToolName(value: unknown): string | null {
  if (typeof value !== "string" || value === "") return null;
  // 制御文字や改行が混じっていても進捗表示が崩れないようにする。
  const cleaned = value.replace(/[\u0000-\u001f\u007f\s]+/gu, " ").trim();
  if (cleaned === "") return null;

  return cleaned.length <= TOOL_NAME_LIMIT ? cleaned : `${cleaned.slice(0, TOOL_NAME_LIMIT)}…`;
}

/** `message.content` の配列を返す。形が違えば空にする。 */
function messageContent(event: Record<string, unknown>): readonly unknown[] {
  const message = event.message;
  if (!isRecord(message) || !Array.isArray(message.content)) return [];

  return message.content;
}

function lastToolName(content: readonly unknown[]): string | null {
  for (const item of [...content].reverse()) {
    if (isRecord(item) && item.type === "tool_use") return safeToolName(item.name);
  }

  return null;
}

function hasToolResult(content: readonly unknown[]): boolean {
  return content.some((item) => isRecord(item) && item.type === "tool_result");
}

/** イベント1つから、直近の活動として残す種類を決める。判定できなければ null。 */
function activityOf(
  event: Record<string, unknown>,
): { kind: ClaudeActivityKind; toolName: string | null } | null {
  if (event.type === "system") return { kind: "startup", toolName: null };
  if (event.type === "result") return { kind: "result", toolName: null };

  if (event.type === "assistant") {
    const toolName = lastToolName(messageContent(event));

    return toolName === null ? { kind: "text", toolName: null } : { kind: "tool_use", toolName };
  }

  if (event.type === "user" && hasToolResult(messageContent(event))) {
    return { kind: "tool_result", toolName: null };
  }

  return null;
}

function applyEvent(activity: ClaudeActivity, event: Record<string, unknown>): ClaudeActivity {
  const sessionId =
    typeof event.session_id === "string" && event.session_id !== ""
      ? event.session_id
      : activity.sessionId;
  const eventCount = activity.eventCount + 1;
  const next = activityOf(event);

  // 種類を判定できないイベントでも、受け取った事実は残す。
  if (next === null) return { ...activity, eventCount, sessionId };

  return { eventCount, kind: next.kind, toolName: next.toolName, sessionId };
}

/** ストリームを受け取りながら要約を作る。 */
export function createActivityTracker(): ClaudeActivityTracker {
  let pending = "";
  let activity = EMPTY_ACTIVITY;

  return {
    push(chunk: string): ClaudeActivity | null {
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      // 最後の要素はまだ改行が来ていない行なので、次の断片を待つ。
      pending = lines.pop() ?? "";

      let changed = false;
      for (const line of lines) {
        if (line.trim() === "") continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          // 進捗の要約が読めないだけで実行を止めない。完了判定は最終結果の検証で行う。
          continue;
        }
        if (!isRecord(parsed)) continue;
        activity = applyEvent(activity, parsed);
        changed = true;
      }

      return changed ? activity : null;
    },
    snapshot: () => activity,
  };
}

/** 入口が実行中に表示する進捗。 */
export type ClaudeProgress = {
  runId: string;
  eventCount: number;
  kind: ClaudeActivityKind | null;
  toolName: string | null;
  /** 活動を受け取った時刻（ISO 8601） */
  at: string;
};

/**
 * 進捗を画面へ出す頻度を抑える。
 *
 * 実行記録はイベントごとに更新したまま、Codexの文脈へ入る進捗行だけを間引く。最終結果は
 * 間隔にかかわらず表示する。
 */
export function createProgressFilter(intervalMs: number): (progress: ClaudeProgress) => boolean {
  let lastShownAt: number | null = null;

  return (progress) => {
    const at = Date.parse(progress.at);
    if (progress.kind === "result") {
      if (!Number.isNaN(at)) lastShownAt = at;
      return true;
    }
    if (Number.isNaN(at)) return true;
    if (lastShownAt !== null && at - lastShownAt < intervalMs) return false;

    lastShownAt = at;
    return true;
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * 進捗を1行にする。
 *
 * **本文もコマンドも出さない。** 出すのは実行記録のID、時刻、イベント数、活動の種類、
 * ツール名だけ。
 */
export function formatActivityLine(progress: ClaudeProgress): string {
  const at = new Date(progress.at);
  const time = Number.isNaN(at.getTime())
    ? progress.at
    : `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`;
  const label = progress.kind === null ? "受信" : ACTIVITY_LABEL[progress.kind];
  const toolName = progress.toolName === null ? "" : ` ${progress.toolName}`;

  return `[claude ${progress.runId}] ${time} ${progress.eventCount}件 ${label}${toolName}`;
}
