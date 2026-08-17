/** 成績を購入日で絞り込む期間。両端を含む。 */
export type ResultsPeriod = {
  readonly from?: string;
  readonly to?: string;
};

/** URL の値を、DB に渡してよい日付だけにする。 */
export function resultsPeriod(input: ResultsPeriod): ResultsPeriod {
  const from = isDate(input.from) ? input.from : undefined;
  const to = isDate(input.to) ? input.to : undefined;

  return { from, to };
}

function isDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
