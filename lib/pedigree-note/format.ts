/** 血統評価で既定として使う見出し。 */
export const PEDIGREE_NOTE_HEADINGS = [
  "概要",
  "母と牝系",
  "産駒の傾向",
  "母父と配合",
  "系統とクロス",
  "適性の素地",
] as const;

const pedigreeNoteHeadings: ReadonlySet<string> = new Set(PEDIGREE_NOTE_HEADINGS);

/**
 * 見出し名だけを独立した行に置いた既存の血統評価を、画面で見出しとして描画できる形にする。
 *
 * 今後の本文は Markdown の見出しとして保存するが、保存済みの本文は書き換えない。
 * 既に Markdown になっている行や、文章中に見出し名が出てくる箇所は変更しない。
 */
export function formatPedigreeNoteBody(body: string): string {
  return body
    .split("\n")
    .map((line) => {
      const heading = line.trim();
      return pedigreeNoteHeadings.has(heading) ? `## ${heading}` : line;
    })
    .join("\n");
}
