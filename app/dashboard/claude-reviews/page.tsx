import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty, PageShell, Section } from "@/components/screens/page-shell";
import { assertCan } from "@/lib/access";
import {
  formatReviewRunTime,
  getReviewRunsView,
  REVIEW_RUN_MODE_LABEL,
} from "@/lib/review-runs";

export const metadata: Metadata = { title: "Claude Code への差し戻し — Vatesteed" };

/**
 * Codex が Claude Code へ差し戻した回数を、依頼ごとに見る画面。
 *
 * **数えるのは、正常完了した実行を差し戻して再開した回数だけ。** 利用上限やAPIエラーからの
 * 再開は往復に入らない（docs/claude-code-bridge.md の「レビューと修正回答の記録」）。
 *
 * 記録はローカルファイルなので、保存済みのJSONをその都度読む。集計結果は保存しない。
 */
export default async function Page() {
  await assertCan("claude.reviews");

  const { local, runs, totals } = await getReviewRunsView();

  return (
    <PageShell
      back={{ href: "/dashboard", label: "ダッシュボード" }}
      lead="Codex が差し戻した回数と指摘の件数を、依頼ごとに並べる。改善のための一時的な記録で、DB には入れていない。"
      title="Claude Code への差し戻し"
    >
      {local ? null : (
        <Section note="記録は手元の .claude/review-runs/ にある" title="ここでは読めない">
          <Empty>
            この記録はローカルファイルにだけ置いてある。デプロイ先からは読まないので、手元で
            起動した画面で確認する。
          </Empty>
        </Section>
      )}

      {local ? (
        <>
          <Section note="記録が残っている依頼だけを数える" title="数">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <p className="text-sm text-muted-foreground">依頼</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{totals.requests}</p>
              </Card>
              <Card>
                <p className="text-sm text-muted-foreground">差し戻しの往復</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{totals.rounds}</p>
              </Card>
              <Card>
                <p className="text-sm text-muted-foreground">指摘</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{totals.notes}</p>
              </Card>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {totals.byMode.map((item) => (
                <Card key={item.mode}>
                  <p className="text-sm text-muted-foreground">
                    {REVIEW_RUN_MODE_LABEL[item.mode]}
                  </p>
                  <p className="mt-1 text-sm">
                    依頼 {item.requests} 件 · 往復 {item.rounds} 回
                  </p>
                </Card>
              ))}
            </div>
          </Section>

          <Section note="1回も差し戻していない依頼は往復0として数える" title="往復数の分布">
            {totals.distribution.length === 0 ? (
              <Empty>まだ記録が無い。</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-md text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 font-medium">往復</th>
                      <th className="py-2 font-medium">依頼</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.distribution.map((item) => (
                      <tr className="border-b border-border/60" key={item.rounds}>
                        <td className="py-2 font-mono text-xs">{item.rounds}</td>
                        <td className="py-2">{item.requests}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section note="新しい実行が上" title="依頼ごと">
            {runs.length === 0 ? (
              <Empty>この仕組みを入れた後に完了した実行がまだ無い。</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-md text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 font-medium">依頼</th>
                      <th className="py-2 font-medium">種類</th>
                      <th className="py-2 font-medium">往復</th>
                      <th className="py-2 font-medium">指摘</th>
                      <th className="py-2 font-medium">最終更新</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr className="border-b border-border/60" key={run.runId}>
                        <td className="py-2">
                          <Link
                            className="font-medium hover:underline"
                            href={`/dashboard/claude-reviews/${run.runId}`}
                          >
                            {run.taskTitle}
                          </Link>
                          <p className="font-mono text-xs text-muted-foreground">{run.runId}</p>
                        </td>
                        <td className="py-2">{REVIEW_RUN_MODE_LABEL[run.mode]}</td>
                        <td className="py-2">
                          {run.rounds}
                          {run.unanswered > 0 ? (
                            <span className="ml-1 text-xs text-muted-foreground">
                              （回答待ち {run.unanswered}）
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2">{run.notes}</td>
                        <td className="py-2 font-mono text-xs text-muted-foreground">
                          {formatReviewRunTime(run.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      ) : null}
    </PageShell>
  );
}
