import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty, PageShell } from "@/components/screens/page-shell";
import { SearchForm } from "@/components/screens/search-form";
import { listJockeys } from "@/lib/jockeys";

export const metadata: Metadata = { title: "騎手 — Vatesteed" };

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string }>;
}) {
  const { q } = await searchParams;
  const jockeys = await listJockeys({ q });

  return (
    <PageShell
      actions={<SearchForm action="/jockeys" defaultValue={q} placeholder="騎手名" />}
      lead={`${jockeys.length} 人。`}
      title="騎手"
    >
      {jockeys.length === 0 ? (
        <Empty>{q ? `「${q}」に当たる騎手はいません。` : "まだ騎手が登録されていません。"}</Empty>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {jockeys.map((jockey) => (
            <li key={jockey.id}>
              <Link href={`/jockeys/${jockey.id}`}>
                <Card className="h-full transition-colors hover:border-foreground/30">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold tracking-tight">{jockey.name}</span>
                    {jockey.affiliation ? (
                      <span className="text-xs text-muted-foreground">{jockey.affiliation}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                    騎乗 {jockey.rideCount} · {jockey.hasNote ? "評価あり" : "評価なし"}
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
