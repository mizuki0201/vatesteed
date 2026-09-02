import Link from "next/link";
import { DEFAULT_HORSE_STATUS, type HorseStatus } from "@/lib/horses";

/** 前へ・次へ。進めない方向は出さない。検索語と表示区分は URL に残す。 */
export function HorsePagination({
  page,
  pageCount,
  q,
  status,
}: {
  readonly page: number;
  readonly pageCount: number;
  readonly q?: string;
  readonly status: HorseStatus;
}) {
  if (pageCount <= 1) return null;

  const href = (target: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status !== DEFAULT_HORSE_STATUS) params.set("status", status);
    if (target > 1) params.set("page", String(target));
    const query = params.toString();

    return query ? `/horses?${query}` : "/horses";
  };

  const linkClass =
    "rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-accent";

  return (
    <nav aria-label="馬の一覧のページ送り" className="mt-6 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link className={linkClass} href={href(page - 1)} rel="prev">
          前へ
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted-foreground">
        {page} / {pageCount} ページ
      </span>
      {page < pageCount ? (
        <Link className={linkClass} href={href(page + 1)} rel="next">
          次へ
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
