import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, Empty, PageShell, Section } from "@/components/screens/page-shell";
import { assertCan } from "@/lib/access";
import { listMemos, MEMO_BODY_MAX, PENDING_STATUSES, type Memo } from "@/lib/memos";
import { record } from "./actions";

export const metadata: Metadata = { title: "メモを残す — Vatesteed" };

const MESSAGE: Readonly<Record<string, string>> = {
  empty: "何も書かれていませんでした。",
  "too-long": `${MEMO_BODY_MAX}字までです。`,
};

/**
 * 外で見かけた話を、その場で1つ残す画面。
 *
 * **入るのは評価ではなく、まだ確かめていない材料。** ここから評価へ直接つながる経路は
 * 無く、裏を取って宛先を決めるのは対話の中で行う（docs/product.md#見かけた話を残して後で確かめる）。
 *
 * **分類の欄を置かない。** 入稿する側に決めさせると、そこが手作業として固定される。
 */
export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly saved?: string; readonly error?: string }>;
}) {
  await assertCan("memos");

  const [{ saved, error }, pending, done] = await Promise.all([
    searchParams,
    listMemos({ statuses: PENDING_STATUSES }),
    listMemos({ statuses: ["取り込み済み", "見送り"], limit: 10 }),
  ]);

  return (
    <PageShell
      back={{ href: "/dashboard", label: "ダッシュボード" }}
      lead="外で見かけた話を、そのまま1つ置く。分類も裏取りもしなくてよい。"
      title="メモを残す"
    >
      <Section
        note="残したあと、Claude Code との対話の中で確かめて、行き先を決める"
        title="残す"
      >
        <form action={record} className="max-w-xl space-y-3">
          <textarea
            aria-label="メモ"
            className="min-h-32 w-full rounded-lg border border-input bg-card px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus:border-ring"
            maxLength={MEMO_BODY_MAX}
            name="body"
            placeholder="見かけた話を、自分の言葉で。&#10;例: ○○、追い切りで一杯に追われていたと書いている人がいた"
            required
          />
          <input
            aria-label="どこで見たか"
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
            name="source"
            placeholder="どこで見たか（URL や媒体の名前。任意）"
            type="text"
          />

          {error ? <p className="text-sm text-destructive">{MESSAGE[error] ?? "残せませんでした。"}</p> : null}
          {saved ? <p className="text-sm text-muted-foreground">残した。</p> : null}

          <button
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground sm:w-auto sm:px-8"
            type="submit"
          >
            残す
          </button>
        </form>

        <p className="mt-3 max-w-xl text-xs text-muted-foreground">
          本文は {MEMO_BODY_MAX}字まで。見たものをそのまま写す場所ではないので、自分の言葉で書く。
        </p>
      </Section>

      <Section note="古いものから片付ける" title={`取り込み待ち（${pending.length}）`}>
        {pending.length === 0 ? (
          <Empty>待っているメモはない。</Empty>
        ) : (
          <div className="space-y-3">
            {pending.map((memo) => (
              <MemoCard key={memo.id} memo={memo} />
            ))}
          </div>
        )}
      </Section>

      <Section note="直近10件" title="片付いたもの">
        {done.length === 0 ? (
          <Empty>まだ何も取り込んでいない。</Empty>
        ) : (
          <div className="space-y-3">
            {done.map((memo) => (
              <MemoCard key={memo.id} memo={memo} />
            ))}
          </div>
        )}
      </Section>
    </PageShell>
  );
}

/** 1つのメモ。**裏取りの結果と行き先も一緒に出す**（何をされたのかが分かるように）。 */
function MemoCard({ memo }: { readonly memo: Memo }) {
  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={memo.status === "未処理" ? "default" : "secondary"}>{memo.status}</Badge>
        <span>{memo.createdAt}</span>
        {memo.source ? <span className="truncate">{memo.source}</span> : null}
      </div>

      <p className="text-sm leading-relaxed whitespace-pre-wrap">{memo.body}</p>

      {memo.verification ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium">確かめたこと:</span> {memo.verification}
        </p>
      ) : null}
      {memo.outcome ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium">行き先:</span> {memo.outcome}
        </p>
      ) : null}
    </Card>
  );
}
