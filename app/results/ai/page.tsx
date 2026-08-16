import type { Metadata } from "next";
import { PageShell } from "@/components/screens/page-shell";
import { ResultsView } from "@/components/screens/results-view";
import { getResultsTotal, listResultsByRace } from "@/lib/results";

export const metadata: Metadata = { title: "AI の成績 — Vatesteed" };

export default async function Page() {
  const [total, races] = await Promise.all([getResultsTotal("ai"), listResultsByRace("ai")]);

  return (
    <PageShell
      lead="馬券は実際には買わず、購入の記録だけ残して回収率を測っています。1レースの予算は 2,000円で固定です。"
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
