import Link from "next/link";
import type { Metadata } from "next";
import { Card, PageShell, Section } from "@/components/screens/page-shell";
import { can, requiredLevel, type Capability } from "@/lib/access";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Vatesteed",
  description: "競馬を予想する上でAIと人間のいいとこどりを実現したいAIエージェントです。",
};

/**
 * 各画面へ入るためのまとめ。
 *
 * **見えないものは出さない。** 何があるかだけ示して、足りないレベルのものは「もう少し
 * 上のレベルで見られる」と分かる形にする。
 */
type Entry = {
  readonly href: string;
  readonly title: string;
  readonly body: string;
  readonly capability: Capability;
};

const GROUPS: readonly { readonly heading: string; readonly entries: readonly Entry[] }[] = [
  {
    heading: "予想と結果",
    entries: [
      {
        href: "/races",
        title: "レース",
        body: "出馬表・着順・払戻と、AI が分析した内容の詳細を見る",
        capability: "races",
      },
      {
        href: "/results/ai",
        title: "AI の成績",
        body: "AI の馬券成績。レースごとの内訳つき",
        capability: "results.ai",
      },
      {
        href: "/results/mine",
        title: "自分の成績",
        body: "自分で予想して買った分。AI とは別に測る",
        capability: "results.mine",
      },
    ],
  },
  {
    heading: "各種データ",
    entries: [
      { href: "/horses", title: "馬", body: "どういう馬かの見立てと、レースごとの分析", capability: "horses" },
      { href: "/jockeys", title: "騎手", body: "乗り方の癖と騎乗の履歴", capability: "jockeys" },
      { href: "/trainers", title: "厩舎", body: "仕上げ方とローテーション", capability: "trainers" },
      { href: "/courses", title: "コース", body: "コースごとの傾向", capability: "courses" },
      {
        href: "/notes",
        title: "最新の分析結果",
        body: "馬・騎手・厩舎・コースの分析結果を、新しい順に並べる",
        capability: "notes.raw",
      },
    ],
  },
  {
    heading: "そのほか",
    entries: [
      {
        href: "/tech",
        title: "技術情報",
        body: "構成と DB 設計",
        capability: "tech",
      },
      {
        href: "/about",
        title: "Vatesteedについて",
        body: "Vatesteed が何を目指しているか",
        capability: "about",
      },
      {
        href: "/dashboard",
        title: "ダッシュボード",
        body: "管理者専用のダッシュボード",
        capability: "dashboard",
      },
      {
        href: "/dashboard/record-memo",
        title: "メモを残す",
        body: "外で見かけた話を1つ置く。裏取りと行き先は、あとの対話で決める",
        capability: "memos",
      },
    ],
  },
];

export default async function Page() {
  const viewer = await getViewer();

  return (
    <PageShell
      lead="競馬を予想する上でAIと人間のいいとこどりを実現したいAIエージェントです。"
      title="🐎 Vatesteed"
    >
      {GROUPS.map((group) => (
        <Section key={group.heading} title={group.heading}>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.entries.map((entry) =>
              can(viewer, entry.capability) ? (
                <Link href={entry.href} key={entry.href}>
                  <Card className="h-full transition-colors hover:border-foreground/30">
                    <p className="font-semibold tracking-tight">{entry.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{entry.body}</p>
                    <p className="mt-2 font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                      {entry.href}
                    </p>
                  </Card>
                </Link>
              ) : (
                <Card className="h-full opacity-55" key={entry.href}>
                  <p className="font-semibold tracking-tight">{entry.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{entry.body}</p>
                  <p className="mt-2 font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                    {requiredLevel(entry.capability)} 以上
                  </p>
                </Card>
              ),
            )}
          </div>
        </Section>
      ))}
    </PageShell>
  );
}
