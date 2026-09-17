/**
 * 画面から届いた1つの値を確かめる部品。**DB を触らない。**
 *
 * どれも「空」と「正しくない」を分けて返す。空は `null`、正しくなければ `undefined`。
 * フォームの欄が無いときは `FormData#get` が null を返すので、null も空として扱う。
 *
 * **文字列以外（ファイルなど）が届いたら正しくないとして扱う。** Server Function は画面を
 * 通らない POST からも呼べるため。
 */

/** 前後の空白を落とした文字列。空なら null。文字列でなければ undefined。 */
export function text(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

/** 行の ID。数字だけの文字列（数値でもよい）。空なら null。 */
export function id(value: unknown): string | null | undefined {
  const raw = typeof value === "number" ? String(value) : text(value);

  if (raw === null || raw === undefined) return raw;

  return /^[1-9][0-9]*$/.test(raw) ? raw : undefined;
}

/** 範囲つきの整数。空なら null。 */
export function integer(
  value: unknown,
  range: { readonly min: number; readonly max: number },
): number | null | undefined {
  const raw = typeof value === "number" ? String(value) : text(value);

  if (raw === null || raw === undefined) return raw;
  if (!/^-?[0-9]+$/.test(raw)) return undefined;

  const number = Number(raw);

  return number >= range.min && number <= range.max ? number : undefined;
}

/** 決まった値のどれか。空なら null。 */
export function oneOf<T extends string>(value: unknown, values: readonly T[]): T | null | undefined {
  const raw = text(value);

  if (raw === null || raw === undefined) return raw;

  return values.find((item) => item === raw);
}

/**
 * `2026-09-17` の形の、実在する日付。空なら null。
 *
 * `2026-02-30` のような、形だけ合っていて実在しない日付は弾く。
 */
export function date(
  value: unknown,
  range: { readonly min?: string; readonly max?: string } = {},
): string | null | undefined {
  const raw = text(value);

  if (raw === null || raw === undefined) return raw;
  if (!isCalendarDate(raw)) return undefined;
  if (range.min !== undefined && raw < range.min) return undefined;
  if (range.max !== undefined && raw > range.max) return undefined;

  return raw;
}

/** チェックボックス。チェックされていれば `on` が届き、されていなければ欄ごと届かない。 */
export function checked(value: unknown): boolean {
  return value === "on" || value === "true" || value === true;
}

/** 日本時間の今日（`2026-09-17` の形）。 */
export function todayInJapan(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
