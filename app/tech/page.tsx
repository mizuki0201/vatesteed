import Link from "next/link";
import type { Metadata } from "next";
import { Card, PageShell, Section } from "@/components/screens/page-shell";

export const metadata: Metadata = { title: "技術情報 — Vatesteed" };

/**
 * 技術情報のまとめ。**静的な画面。** DB からは何も引かない。
 *
 * 中身が古くなることは避けられないので、**最終更新日を画面に出して**読む人が鮮度を
 * 判断できるようにする。書き換えたら日付も直すこと。
 */
const UPDATED_ON = "2026-08-16";

const STACK: readonly { readonly label: string; readonly value: string; readonly note: string }[] = [
  { label: "言語", value: "TypeScript", note: "型は素の tsc で見る" },
  {
    label: "エージェント",
    value: "eve",
    note: "Phase 1 では起動せず、Claude Code をエンジンとして使っている",
  },
  { label: "Web", value: "Next.js 16（App Router）", note: "画面はすべてサーバー側で描く" },
  { label: "UI", value: "Tailwind CSS 4 / shadcn", note: "画面には JavaScript をほぼ置かない" },
  { label: "データベース", value: "Neon（Postgres）", note: "ORM は使わず、SQL を手で書く" },
  { label: "ホスティング", value: "Vercel", note: "main へのコミットがそのまま本番へ出る" },
  { label: "ランタイム", value: "Node.js 24", note: "mise で固定。Vercel と揃えている" },
  { label: "パッケージ管理", value: "pnpm", note: "設定は pnpm-workspace.yaml 側" },
];

const PAGES: readonly { readonly href: string; readonly title: string; readonly body: string }[] = [
  {
    href: "/tech/database",
    title: "DB 設計",
    body: "24テーブルの構成と、テーブルどうしのつながり",
  },
];

export default function Page() {
  return (
    <PageShell
      lead={
        <>
          Vatesteed をどう作っているか。
          <span className="text-foreground">最終更新 {UPDATED_ON}</span>
          （手で書いている画面なので、この日付より後の変更は反映されていません）
        </>
      }
      title="技術情報"
    >
      <Section title="構成">
        <div className="grid gap-2 sm:grid-cols-2">
          {STACK.map((item) => (
            <Card key={item.label}>
              <p className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                {item.label}
              </p>
              <p className="mt-1 font-semibold tracking-tight">{item.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.note}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="くわしく">
        <div className="grid gap-2 sm:grid-cols-2">
          {PAGES.map((page) => (
            <Link href={page.href} key={page.href}>
              <Card className="h-full transition-colors hover:border-foreground/30">
                <p className="font-semibold tracking-tight">{page.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{page.body}</p>
                <p className="mt-2 font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                  {page.href}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="決めていること">
        <div className="space-y-2">
          <Card>
            <p className="font-semibold tracking-tight">閲覧レベルを URL に出さない</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              誰に何を見せるかは1つの表で持ち、URL は内容だけで決めています。公開範囲を変えても
              URL が変わらないので、外に出したリンクが壊れません。
            </p>
          </Card>
          <Card>
            <p className="font-semibold tracking-tight">認可の判定はデータを取る手前に置く</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              画面側で隠すだけにすると、書き忘れた画面から中身が出ます。DB を読む関数の中で
              判定しているので、忘れてもデータが出てきません。
            </p>
          </Card>
          <Card>
            <p className="font-semibold tracking-tight">画面からは書き込めない</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              評価を入れる導線は Claude Code 側にあります。画面を先に作ると「人間が手で入力する」
              前提が固まってしまうため、読む側だけを作っています。
            </p>
          </Card>
        </div>
      </Section>
    </PageShell>
  );
}
