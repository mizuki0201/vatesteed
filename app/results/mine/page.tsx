import type { Metadata } from "next";
import { PageShell } from "@/components/screens/page-shell";
import { ResultsFilter } from "@/components/screens/results-filter";
import { ResultsView } from "@/components/screens/results-view";
import { getResultsTotal, listResultsByRace, resultsPeriod } from "@/lib/results";

export const metadata: Metadata = { title: "自分の成績 — Vatesteed" };

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly from?: string; readonly to?: string }>;
}) {
  const period = resultsPeriod(await searchParams);
  const [total, races] = await Promise.all([
    getResultsTotal("mine", period),
    listResultsByRace("mine", period),
  ]);

  return (
    <PageShell
      lead="自分で予想して買った馬券の成績です。"
      actions={<ResultsFilter action="/results/mine" period={period} />}
      title="自分の成績"
    >
      <ResultsView
        emptyMessage="まだ自分の買い目が入っていません。"
        races={races}
        total={total}
      />
    </PageShell>
  );
}
