import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty, PageShell } from "@/components/screens/page-shell";
import { SearchForm } from "@/components/screens/search-form";
import { listRaces } from "@/lib/races";

export const metadata: Metadata = { title: "レース — Vatesteed" };

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string }>;
}) {
  const { q } = await searchParams;
  const races = await listRaces({ q });

  return (
    <PageShell
      actions={<SearchForm action="/races" defaultValue={q} placeholder="レース名・競馬場" />}
      lead={`${races.length} 件。新しい順に並べています。`}
      title="レース"
    >
      {races.length === 0 ? (
        <Empty>
          {q ? `「${q}」に当たるレースはありません。` : "まだレースが登録されていません。"}
        </Empty>
      ) : (
        <ul className="space-y-2">
          {races.map((race) => (
            <li key={race.id}>
              <Link href={`/races/${race.id}`}>
                <Card className="transition-colors hover:border-foreground/30">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-mono text-xs text-muted-foreground">{race.raceDate}</span>
                    <span className="font-semibold tracking-tight">
                      {race.raceName ?? "（名前なし）"}
                    </span>
                    {race.grade ? (
                      <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">
                        {race.grade}
                      </span>
                    ) : null}
                    <span className="text-sm text-muted-foreground">
                      {race.track} {race.surface}
                      {race.distanceM}m · {race.entryCount}頭
                    </span>
                    <span className="ml-auto flex gap-2 font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                      {race.hasPrediction ? <span>予想した</span> : null}
                      {race.hasResult ? <span>結果あり</span> : null}
                    </span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
