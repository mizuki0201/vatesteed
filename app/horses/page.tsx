import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty, PageShell } from "@/components/screens/page-shell";
import { SearchForm } from "@/components/screens/search-form";
import { listHorses } from "@/lib/horses";

export const metadata: Metadata = { title: "馬 — Vatesteed" };

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string }>;
}) {
  const { q } = await searchParams;
  const horses = await listHorses({ q });

  return (
    <PageShell
      actions={<SearchForm action="/horses" defaultValue={q} placeholder="馬名" />}
      lead={`${horses.length} 頭。対話した馬の分だけ溜まります。`}
      title="馬"
    >
      {horses.length === 0 ? (
        <Empty>{q ? `「${q}」に当たる馬はいません。` : "まだ馬が登録されていません。"}</Empty>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {horses.map((horse) => (
            <li key={horse.id}>
              <Link href={`/horses/${horse.id}`}>
                <Card className="h-full transition-colors hover:border-foreground/30">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold tracking-tight">{horse.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {horse.sex ?? ""}
                      {horse.birthYear ? ` ${horse.birthYear}年生` : ""}
                      {horse.trainerName ? ` · ${horse.trainerName}` : ""}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                    出走 {horse.entryCount} · {horse.hasNote ? "評価あり" : "評価なし"}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
