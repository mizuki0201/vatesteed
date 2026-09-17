/**
 * 馬の現役と引退の切り替え。**DB を触らない部分だけを分けてある**
 * （素の Node で走るテストから読めるようにするため。`lib/memos` の input.ts と同じ）。
 */

/**
 * 引退したことは分かっても、日付が分からない馬に入れる引退日（docs/data-model.md#horses）。
 */
export const UNKNOWN_RETIRED_ON = "1900-01-01";

/** 引退日を画面に出す形にする。日付が分からない馬は「日付不明」。 */
export function retiredOnLabel(retiredAt: string): string {
  return retiredAt === UNKNOWN_RETIRED_ON ? "日付不明" : retiredAt;
}

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
  | {
      readonly ok: true;
      readonly horseId: string;
      readonly target: RetirementTarget;
      /** 現役に戻すときは null。 */
      readonly retiredOn: string | null;
    }
  | { readonly ok: false };

/**
 * 画面から届いた値を確かめる。`today` は日本時間の今日（`2026-09-17` の形）。
 *
 * **Server Function は画面を通らない POST からも呼べる**ので、馬の ID が数字だけか、
 * 切り替えた先が2つのどちらかか、引退日が実在する日付かをここで見る。
 *
 * 引退日は任意。空なら `UNKNOWN_RETIRED_ON` にする。`UNKNOWN_RETIRED_ON` より前と、
 * 今日より後は弾く。現役に戻すときは引退日を見ない。
 */
export function parseRetirementInput(
  horseId: unknown,
  target: unknown,
  retiredOn: unknown,
  today: string,
): RetirementInput {
  const id = typeof horseId === "string" ? horseId.trim() : "";

  if (!/^[1-9][0-9]*$/.test(id)) return { ok: false };
  if (target === "active") return { ok: true, horseId: id, target, retiredOn: null };
  if (target !== "retired") return { ok: false };

  // フォームに欄が無ければ null で届く。それ以外で文字列でないものは画面を通っていない
  if (retiredOn !== null && retiredOn !== undefined && typeof retiredOn !== "string") {
    return { ok: false };
  }

  const date = retiredOn?.trim() ?? "";

  if (date === "") return { ok: true, horseId: id, target, retiredOn: UNKNOWN_RETIRED_ON };
  if (!isCalendarDate(date)) return { ok: false };
  if (date < UNKNOWN_RETIRED_ON || date > today) return { ok: false };

  return { ok: true, horseId: id, target, retiredOn: date };
}

/** `2026-02-30` のような、形だけ合っていて実在しない日付を弾く。 */
function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
