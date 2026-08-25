/**
 * 一覧の検索。
 *
 * **JavaScript を使わない。** `method="get"` の素のフォームで、入力した値が `?q=` に付いて
 * 同じ画面をもう一度サーバーで描くだけ。検索結果の URL がそのまま共有できる形になる。
 *
 * `keep` に渡した検索パラメータは隠しの入力として一緒に送る。騎手の一覧の所属の区分のように、
 * 検索しても保ちたい絞り込みがある画面で使う。
 */
export function SearchForm({
  action,
  defaultValue,
  keep,
  placeholder,
}: {
  readonly action: string;
  readonly defaultValue?: string;
  readonly keep?: Readonly<Record<string, string>>;
  readonly placeholder: string;
}) {
  return (
    <form action={action} className="flex w-full max-w-md gap-2" method="get">
      {Object.entries(keep ?? {}).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      <input
        aria-label="検索"
        className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
        defaultValue={defaultValue}
        name="q"
        placeholder={placeholder}
        type="search"
      />
      <button
        className="shrink-0 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-accent"
        type="submit"
      >
        探す
      </button>
    </form>
  );
}
