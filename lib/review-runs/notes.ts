/**
 * タスクMarkdownの「受け入れ結果」から、Codex の指摘を読む。
 *
 * 差し戻すとき、Codex は「受け入れ結果」に `差し戻し` と書き、具体的な指摘を1項目1箇条書きで
 * 残してから再開する（docs/development.md の「進行役の必須レビューと受け入れ」）。ここは
 * その箇条書きを1件ずつに分けるだけで、往復番号は付けない。
 */

/** 指摘を読み取る見出し。 */
export const ACCEPTANCE_SECTION = "受け入れ結果";

/** 差し戻したことを示すだけの行。指摘そのものではないので数えない。 */
const SEND_BACK_MARKERS: readonly string[] = ["差し戻し", "差し戻し。"];

/** 見出し1つぶんの中身を返す。見出しが無ければ空文字。 */
function sectionBody(taskBody: string, name: string): string {
  const pattern = new RegExp(`^##\\s+${name}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, "m");

  return taskBody.match(pattern)?.[1] ?? "";
}

function isTopLevelBullet(line: string): boolean {
  return /^[-*]\s+/.test(line);
}

/** 「受け入れ結果」に、差し戻したことを示す行があるか。 */
export function hasSendBackMarker(taskBody: string): boolean {
  return sectionBody(taskBody, ACCEPTANCE_SECTION)
    .split(/\r?\n/)
    .some((line) => {
      const value = isTopLevelBullet(line)
        ? line.replace(/^[-*]\s+/, "").trim()
        : line.trim();

      return SEND_BACK_MARKERS.includes(value);
    });
}

/**
 * 「受け入れ結果」の箇条書きを1項目1件にして返す。
 *
 * 字下げした行と入れ子の箇条書きは、直前の項目の続きとして同じ1件にまとめる。項目の外にある
 * 地の文は指摘として数えない。
 */
export function parseAcceptanceNotes(taskBody: string): readonly string[] {
  const items: string[][] = [];

  for (const line of sectionBody(taskBody, ACCEPTANCE_SECTION).split(/\r?\n/)) {
    if (isTopLevelBullet(line)) {
      items.push([line.replace(/^[-*]\s+/, "").trim()]);
      continue;
    }
    if (line.trim() === "") continue;
    // 字下げした続きの行だけを、直前の指摘へつなげる。左端から始まる地の文は項目にしない。
    if (items.length > 0 && /^\s/.test(line)) items[items.length - 1].push(line.trim());
  }

  return items
    .map((lines) => lines.join("\n").trim())
    .filter((note) => note !== "" && !SEND_BACK_MARKERS.includes(note));
}

/**
 * 差し戻しとして再開してよい「受け入れ結果」を読み、具体的な指摘を返す。
 *
 * 印だけ、または指摘だけではClaude Codeを起動しない。受け入れ前の再開を差し戻しとして
 * 誤記録したり、空の往復を作ったりしないため。
 */
export function parseSendBackNotes(taskBody: string): readonly string[] {
  if (!hasSendBackMarker(taskBody)) {
    throw new Error("「受け入れ結果」に「差し戻し」がありません。再開前に記録してください。");
  }

  const notes = parseAcceptanceNotes(taskBody);
  if (notes.length === 0) {
    throw new Error("「受け入れ結果」に具体的な指摘がありません。1項目1箇条書きで記録してください。");
  }

  return notes;
}
