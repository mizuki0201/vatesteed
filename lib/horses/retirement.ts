/**
 * 馬の現役と引退の切り替え。**DB を触らない部分だけを分けてある**
 * （素の Node で走るテストから読めるようにするため。`lib/memos` の input.ts と同じ）。
 */

/** 切り替えた先。 */
export type RetirementTarget = "active" | "retired";

/** いまの状態から、切り替えた先を決める。`retired_at` が入っていれば引退として扱う。 */
export function nextRetirementTarget(retiredAt: string | null): RetirementTarget {
  return retiredAt ? "active" : "retired";
}

/** 切り替えた先ごとの、メニューと確認に出す名前。 */
export const RETIREMENT_TARGET_LABELS = {
  active: "現役に変更",
  retired: "引退に変更",
} as const satisfies Record<RetirementTarget, string>;

export type RetirementInput =
  | { readonly ok: true; readonly horseId: string; readonly target: RetirementTarget }
  | { readonly ok: false };

/**
 * 画面から届いた値を確かめる。
 *
 * **Server Function は画面を通らない POST からも呼べる**ので、馬の ID が数字だけか、
 * 切り替えた先が2つのどちらかかをここで見る。
 */
export function parseRetirementInput(horseId: unknown, target: unknown): RetirementInput {
  const id = typeof horseId === "string" ? horseId.trim() : "";

  if (!/^[1-9][0-9]*$/.test(id)) return { ok: false };
  if (target !== "active" && target !== "retired") return { ok: false };

  return { ok: true, horseId: id, target };
}
