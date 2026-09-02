/**
 * 馬の一覧を切り替える表示区分。
 *
 * 4つは互いに重ならない。海外の馬は `retired_at` で分けず、現役にも引退にも出さない。
 * 引退の確認は日本の馬を前提にした手順（docs/data-model.md の `retired_at`）なので、
 * 海外の馬に同じ確認ができず、現役に混ざってしまうため。
 */
export type HorseStatus = "all" | "active" | "retired" | "overseas";

/** 区分ごとの、切り替えに出す名前と、件数や空のときに使う呼び方。 */
export const HORSE_STATUSES = {
  all: { label: "すべて", horsesLabel: "馬" },
  active: { label: "現役", horsesLabel: "現役馬" },
  retired: { label: "引退", horsesLabel: "引退馬" },
  overseas: { label: "海外", horsesLabel: "海外馬" },
} as const satisfies Record<
  HorseStatus,
  { readonly label: string; readonly horsesLabel: string }
>;

/** 一覧に並べる順。 */
export const HORSE_STATUS_ORDER = [
  "all",
  "active",
  "retired",
  "overseas",
] as const satisfies readonly HorseStatus[];

/** 一覧を開いたときに出す区分。 */
export const DEFAULT_HORSE_STATUS = "active" satisfies HorseStatus;

/** URL の `?status=` を区分にする。**知らない値と未指定は現役。** */
export function horseStatus(value: string | undefined): HorseStatus {
  return HORSE_STATUS_ORDER.find((status) => status === value) ?? DEFAULT_HORSE_STATUS;
}

/** 切り替えに出す区分の名前。 */
export function horseStatusLabel(status: HorseStatus): string {
  return HORSE_STATUSES[status].label;
}

/** その区分の馬の呼び方。「海外馬はまだ登録されていません。」のように使う。 */
export function horseStatusHorsesLabel(status: HorseStatus): string {
  return HORSE_STATUSES[status].horsesLabel;
}

/**
 * その区分に当たる馬を絞る SQL の条件。`horses` を `h` で参照する文に埋める。
 *
 * 値を埋め込まず、区分ごとに書いた条件をそのまま返す。`horseStatus()` を通した値だけが
 * 鍵になるので、URL から来た文字列が SQL に入ることはない。
 */
export const HORSE_STATUS_CONDITIONS = {
  all: "TRUE",
  active: "h.is_overseas = false AND h.retired_at IS NULL",
  retired: "h.is_overseas = false AND h.retired_at IS NOT NULL",
  overseas: "h.is_overseas = true",
} as const satisfies Record<HorseStatus, string>;

/** その区分に当たる馬を絞る SQL の条件。 */
export function horseStatusCondition(status: HorseStatus): string {
  return HORSE_STATUS_CONDITIONS[status];
}
