import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty, PageShell } from "@/components/screens/page-shell";
import { HorsePagination } from "@/components/screens/horse-pagination";
import { HorseSearchForm } from "@/components/screens/horse-search-form";
import { HorseStatusSegments } from "@/components/screens/horse-status-segments";
import { horseStatus, horseStatusHorsesLabel, listHorses, pageNumber } from "@/lib/horses";

export const metadata: Metadata = { title: "馬 — Vatesteed" };

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<{
    readonly q?: string;
    readonly status?: string;
    readonly page?: string;
  }>;
}) {
  const { q, status: rawStatus, page: rawPage } = await searchParams;
  const status = horseStatus(rawStatus);
  const { horses, total, page, pageCount } = await listHorses({
    q,
    status,
    page: pageNumber(rawPage),
  });
  const horsesLabel = horseStatusHorsesLabel(status);

  return (
    <PageShell
      actions={<HorseSearchForm q={q} status={status} />}
      lead="引退は確認できた時点で反映します。引退直後の馬は、現役として表示されることがあります。"
      title="馬"
    >
      <HorseStatusSegments q={q} status={status} />
      <p className="mb-4 text-sm text-muted-foreground">全 {total} 頭</p>
      {horses.length === 0 ? (
        <Empty>
          {q ? `「${q}」に当たる${horsesLabel}はいません。` : `${horsesLabel}はまだ登録されていません。`}
        </Empty>
      ) : (
        <>
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
                      出走 {horse.entryCount} · {horse.hasNote ? "見立てあり" : "見立てなし"}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
          <HorsePagination page={page} pageCount={pageCount} q={q} status={status} />
        </>
      )}
    </PageShell>
  );
}
