import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty, PageShell } from "@/components/screens/page-shell";
import { JockeyAffiliationSegments } from "@/components/screens/jockey-affiliation-segments";
import { SearchForm } from "@/components/screens/search-form";
import {
  DEFAULT_AFFILIATION_GROUP,
  affiliationGroup,
  affiliationGroupLabel,
  listJockeys,
} from "@/lib/jockeys";

export const metadata: Metadata = { title: "騎手 — Vatesteed" };

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string; readonly group?: string }>;
}) {
  const { q, group: rawGroup } = await searchParams;
  const group = affiliationGroup(rawGroup);
  const label = affiliationGroupLabel(group);
  const jockeys = await listJockeys({ q, group });

  return (
    <PageShell
      actions={
        <SearchForm
          action="/jockeys"
          defaultValue={q}
          keep={group === DEFAULT_AFFILIATION_GROUP ? undefined : { group }}
          placeholder="騎手名"
        />
      }
      title="騎手"
    >
      <JockeyAffiliationSegments group={group} q={q} />
      <p className="mb-4 text-sm text-muted-foreground">
        {label} {jockeys.length} 人
      </p>
      {jockeys.length === 0 ? (
        <Empty>
          {q
            ? `${label}に「${q}」に当たる騎手はいません。`
            : `${label}の騎手はまだ登録されていません。`}
        </Empty>
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
                    騎乗 {jockey.rideCount} · {jockey.hasNote ? "見立てあり" : "見立てなし"}
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
