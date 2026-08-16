import type { Metadata } from "next";
import { PageShell } from "@/components/screens/page-shell";
import { ResultsView } from "@/components/screens/results-view";
import { getResultsTotal, listResultsByRace } from "@/lib/results";

export const metadata: Metadata = { title: "自分の成績 — Vatesteed" };

export default async function Page() {
  const [total, races] = await Promise.all([getResultsTotal("mine"), listResultsByRace("mine")]);

  return (
    <PageShell
      lead="自分で予想して買った分。AI とは別のテーブルで持ち、混ぜずに測ります。"
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
