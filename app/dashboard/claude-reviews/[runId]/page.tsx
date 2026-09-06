import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Card, Empty, PageShell, Section } from "@/components/screens/page-shell";
import { assertCan } from "@/lib/access";
import {
  formatReviewRunTime,
  getReviewRunDetail,
  REVIEW_RUN_MODE_LABEL,
} from "@/lib/review-runs";

export const metadata: Metadata = { title: "差し戻しの中身 — Vatesteed" };

/** 完了報告と修正回答は、改行をそのまま出す。Markdown として組み直さない。 */
function Report({ children }: { readonly children: string }) {
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">{children}</p>
  );
}

/**
 * 1依頼ぶんの差し戻しを、時系列で見る画面。
 *
 * 最初の完了報告から始め、往復ごとに Codex の指摘と Claude Code の修正回答を並べる。
 */
export default async function Page({
  params,
}: {
  readonly params: Promise<{ readonly runId: string }>;
}) {
  await assertCan("claude.reviews");

  const { runId } = await params;
  const { local, record } = await getReviewRunDetail(runId);

  if (!local) {
    return (
      <PageShell
        back={{ href: "/dashboard/claude-reviews", label: "差し戻しの一覧" }}
        title="差し戻しの中身"
      >
        <Section note="記録は手元の .claude/review-runs/ にある" title="ここでは読めない">
          <Empty>
            この記録はローカルファイルにだけ置いてある。デプロイ先からは読まないので、手元で
            起動した画面で確認する。
          </Empty>
        </Section>
      </PageShell>
    );
  }

  if (record === null) notFound();

  return (
    <PageShell
      back={{ href: "/dashboard/claude-reviews", label: "差し戻しの一覧" }}
      lead={
        <>
          {REVIEW_RUN_MODE_LABEL[record.mode]} · {record.taskPath} · 往復{" "}
          {record.rounds.length} 回 · 実行記録 {record.runId}
        </>
      }
      title={record.taskTitle}
    >
      <Section note={formatReviewRunTime(record.firstReportAt)} title="最初の完了報告">
        {record.firstReport === null ? (
          <Empty>この実行では、最初の完了報告を記録していない。</Empty>
        ) : (
          <Card>
            <Report>{record.firstReport}</Report>
          </Card>
        )}
      </Section>

      {record.rounds.length === 0 ? (
        <Section note="差し戻しはまだ記録されていない" title="差し戻し">
          <Empty>差し戻しはまだ無い。</Empty>
        </Section>
      ) : null}

      {record.rounds.map((round) => (
        <Section
          key={round.number}
          note={`${formatReviewRunTime(round.openedAt)} 差し戻し`}
          title={`${round.number}回目`}
        >
          <Card>
            <p className="font-semibold tracking-tight">Codex の指摘</p>
            {round.notes.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                「受け入れ結果」に箇条書きの指摘が無かった。
              </p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
                {round.notes.map((note, index) => (
                  // 指摘は本文そのものが並びの識別になる。並び替えも削除もしない。
                  <li className="whitespace-pre-wrap" key={`${round.number}-${index}`}>
                    {note}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="mt-3">
            <p className="font-semibold tracking-tight">
              Claude Code の修正回答
              {round.repliedAt === null ? null : (
                <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                  {formatReviewRunTime(round.repliedAt)}
                </span>
              )}
            </p>
            {round.reply === null ? (
              <p className="mt-2 text-sm text-muted-foreground">まだ返っていない。</p>
            ) : (
              <div className="mt-2">
                <Report>{round.reply}</Report>
              </div>
            )}
          </Card>
        </Section>
      ))}
    </PageShell>
  );
}
