/**
 * 入稿された値を、DB に入れられる形に整える。**DB を触らない部分だけを分けてある**
 * （素の Node で走るテストから読めるようにするため。`lib/results` の period.ts と同じ）。
 */

/**
 * 本文の長さの上限。
 *
 * **正本は DB の `memos_body_length` で、ここはその写し。** 画面で弾いて分かりやすく
 * 返すために持っているだけなので、**ここを緩めても DB は通らない**。
 */
export const MEMO_BODY_MAX = 400;

export type MemoInput =
  | { readonly ok: true; readonly body: string; readonly source: string | null }
  | { readonly ok: false; readonly reason: "empty" | "too-long" };

/**
 * 入稿された値を確かめる。
 *
 * **前後の空白を落としてから見る。** スマホから貼り付けると末尾に改行が付くことがあり、
 * それを長さに数えると 400字ちょうどのメモが入らなくなる。
 *
 * **長さはコードポイントで数える。** DB 側の `char_length()` がそう数えるので、`.length`
 * で見ると絵文字や一部の漢字を含むメモだけ、画面を通ったのに DB で弾かれる。
 */
export function normalizeMemoInput(body: unknown, source: unknown): MemoInput {
  const trimmedBody = String(body ?? "").trim();

  if (trimmedBody === "") return { ok: false, reason: "empty" };
  if ([...trimmedBody].length > MEMO_BODY_MAX) return { ok: false, reason: "too-long" };

  const trimmedSource = String(source ?? "").trim();

  return { ok: true, body: trimmedBody, source: trimmedSource === "" ? null : trimmedSource };
}
