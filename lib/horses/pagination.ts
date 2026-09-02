/**
 * 馬の一覧のページ送り。
 *
 * 一覧に出せる頭数を固定の上限で切ると、名前順で後ろの馬が画面から消える。ページに
 * 分けて、どの馬にも一覧から辿り着けるようにする。
 */

/** 1ページに出す頭数。 */
export const HORSE_PAGE_SIZE = 50;

/** ページ送りの現在地。画面と SQL の両方がこれを使う。 */
export type HorsePage = {
  /** 1以上、総ページ数以下に収めたページ番号。 */
  readonly page: number;
  /** 総ページ数。1頭も無いときも1。 */
  readonly pageCount: number;
  /** SQL の OFFSET に渡す頭数。 */
  readonly offset: number;
};

/**
 * URL の `?page=` をページ番号にする。
 *
 * **1以上の整数だけを受け付け、それ以外は1ページ目にする。** 小数・負の数・数字以外は
 * 打ち間違いか作られたURLで、どちらも先頭から見せるのが自然なため。総ページ数を超える
 * 値をここでは弾かない。件数が分かるのは DB を読んだ後で、`horsePage()` が最終ページに
 * 寄せる。
 */
export function pageNumber(value: string | undefined): number {
  if (value === undefined || !/^\d+$/.test(value)) return 1;

  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

/**
 * 全件数と要求されたページ番号から、実際に出すページを決める。
 *
 * **総ページ数を超えるページ番号は最終ページとして扱う。** 空の画面を見せるより、
 * 一番近い中身を見せる方が使える。
 */
export function horsePage(options: {
  readonly total: number;
  readonly page: number;
  readonly perPage?: number;
}): HorsePage {
  const perPage = options.perPage ?? HORSE_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(options.total / perPage));
  const page = Math.min(Math.max(1, options.page), pageCount);

  return { page, pageCount, offset: (page - 1) * perPage };
}
