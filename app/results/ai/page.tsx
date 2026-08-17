import type { Metadata } from "next";
import { PageShell } from "@/components/screens/page-shell";
import { ResultsFilter } from "@/components/screens/results-filter";
import { ResultsView } from "@/components/screens/results-view";
import { getResultsTotal, listResultsByRace, resultsPeriod } from "@/lib/results";

export const metadata: Metadata = { title: "AI の成績 — Vatesteed" };

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly from?: string; readonly to?: string }>;
}) {
  const period = resultsPeriod(await searchParams);
  const [total, races] = await Promise.all([
    getResultsTotal("ai", period),
    listResultsByRace("ai", period),
  ]);

  return (
    <PageShell
      lead="AI の予想に基づく馬券成績です。1レースの予算は 2,000円で固定です。"
      actions={<ResultsFilter action="/results/ai" period={period} />}
      title="AI の成績"
    >
      <ResultsView
        emptyMessage="まだ買い目が1つも入っていません。"
        races={races}
        total={total}
      />
    </PageShell>
  );
}
