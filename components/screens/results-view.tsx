import Link from "next/link";
import { Card, Empty, Section } from "@/components/screens/page-shell";
import type { ResultsRace, ResultsTotal } from "@/lib/results";

/**
 * 成績の中身。**AI と自分で同じ見た目にする**ので、1つの部品を両方の画面から使う。
 *
 * 回収率は「まだ結果が入っていない買い目」を分母に含む。**確定した分だけを都合よく数えない**
 * ため。未確定の件数を必ず一緒に出す。
 */
export function ResultsView({
  total,
  races,
  emptyMessage,
}: {
  readonly total: ResultsTotal;
  readonly races: readonly ResultsRace[];
  readonly emptyMessage: string;
}) {
  if (total.betCount === 0) return <Empty>{emptyMessage}</Empty>;

  return (
    <>
      <Section title="合計">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="回収率" value={formatRate(total.recoveryRate)} />
          <Stat label="購入金額" value={`${total.totalAmount.toLocaleString()}円`} />
          <Stat label="払戻金" value={`${total.returnedAmount.toLocaleString()}円`} />
          <Stat label="予想レース数" value={`${total.raceCount}`} />
        </div>
        {total.pendingCount > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            結果がまだ入っていない買い目が {total.pendingCount} 件あります。
            <span className="text-foreground">その分は「払戻金」に入っていません</span>
            ので、回収率は確定値ではありません。
          </p>
        ) : null}
      </Section>

      <Section title="レースごと">
        <ul className="space-y-2">
          {races.map((race) => (
            <li key={race.raceId ?? "win5"}>
              <Card>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-mono text-xs text-muted-foreground">
                    {race.raceDate ?? "—"}
                  </span>
                  {race.raceId ? (
                    <Link
                      className="font-semibold tracking-tight hover:underline"
                      href={`/races/${race.raceId}`}
                    >
                      {race.raceName ?? "（名前なし）"}
                    </Link>
                  ) : (
                    <span className="font-semibold tracking-tight">WIN5</span>
                  )}
                  <span className="text-sm text-muted-foreground">{race.betCount} 本</span>
                  <span className="ml-auto font-mono text-sm">
                    {race.totalAmount.toLocaleString()}円 →{" "}
                    {race.settled ? `${race.returnedAmount.toLocaleString()}円` : "未確定"}
                    {race.settled ? ` / ${formatRate(race.recoveryRate)}` : ""}
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <Card>
      <p className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
    </Card>
  );
}

function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 1000) / 10}%`;
}
