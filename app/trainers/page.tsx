import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty, PageShell } from "@/components/screens/page-shell";
import { SearchForm } from "@/components/screens/search-form";
import { listTrainers } from "@/lib/trainers";

export const metadata: Metadata = { title: "厩舎 — Vatesteed" };

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string }>;
}) {
  const { q } = await searchParams;
  const trainers = await listTrainers({ q });

  return (
    <PageShell
      actions={<SearchForm action="/trainers" defaultValue={q} placeholder="調教師名" />}
      lead={`${trainers.length} 件。`}
      title="厩舎"
    >
      {trainers.length === 0 ? (
        <Empty>{q ? `「${q}」に当たる厩舎はありません。` : "まだ厩舎が登録されていません。"}</Empty>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {trainers.map((trainer) => (
            <li key={trainer.id}>
              <Link href={`/trainers/${trainer.id}`}>
                <Card className="h-full transition-colors hover:border-foreground/30">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold tracking-tight">{trainer.name}</span>
                    {trainer.affiliation ? (
                      <span className="text-xs text-muted-foreground">{trainer.affiliation}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                    管理馬 {trainer.horseCount} · {trainer.hasNote ? "見立てあり" : "見立てなし"}
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
