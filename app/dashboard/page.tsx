import type { Metadata } from "next";
import { Card, PageShell, Section } from "@/components/screens/page-shell";
import { assertCan, listCapabilities, LEVEL_WEIGHT } from "@/lib/access";

export const metadata: Metadata = { title: "裏側 — Vatesteed" };

/**
 * 裏側。**いま誰に何を見せているかを、実際の設定から出す。**
 *
 * 手で書いた一覧を置くと、コードを変えたときにここだけ古くなる。`lib/access` の表を
 * そのまま読んで並べているので、**表を変えればこの画面も変わる。**
 */
const SCREENS: readonly { readonly url: string; readonly what: string }[] = [
  { url: "/", what: "各画面へのまとめ" },
  { url: "/about", what: "Vatesteed の紹介" },
  { url: "/login", what: "パスワードの入口" },
  { url: "/tech", what: "技術情報のまとめ" },
  { url: "/tech/database", what: "DB 設計" },
  { url: "/races", what: "レースの一覧（検索できる）" },
  { url: "/races/[id]", what: "レース1枚。出走表・印・評価・展開・買い目" },
  { url: "/results/ai", what: "AI の成績と回収率" },
  { url: "/results/mine", what: "自分の成績と収支" },
  { url: "/horses", what: "馬の一覧と1枚" },
  { url: "/jockeys", what: "騎手の一覧と1枚" },
  { url: "/trainers", what: "厩舎の一覧と1枚" },
  { url: "/courses", what: "コースの一覧と1枚" },
  { url: "/notes", what: "評価の横断一覧" },
  { url: "/dashboard", what: "この画面" },
];

export default async function Page() {
  await assertCan("dashboard");

  const capabilities = listCapabilities();

  return (
    <PageShell
      lead="いま誰に何を見せているか。lib/access の設定をそのまま読んで出しています。"
      title="裏側"
    >
      <Section
        note="この表を1行変えれば公開範囲が変わる。URL は変わらない"
        title="誰に何を見せているか"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-md text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 font-medium">見せる単位</th>
                <th className="py-2 font-medium">要るレベル</th>
                <th className="py-2 font-medium">重み</th>
              </tr>
            </thead>
            <tbody>
              {capabilities.map((item) => (
                <tr className="border-b border-border/60" key={item.capability}>
                  <td className="py-2 font-mono text-xs">{item.capability}</td>
                  <td className="py-2 font-mono text-xs uppercase">{item.level}</td>
                  <td className="py-2 font-mono text-xs text-muted-foreground">
                    {LEVEL_WEIGHT[item.level]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section note="仮で全部並べてある。中身はこれから足していく" title="画面の一覧">
        <div className="overflow-x-auto">
          <table className="w-full min-w-md text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 font-medium">URL</th>
                <th className="py-2 font-medium">映すもの</th>
              </tr>
            </thead>
            <tbody>
              {SCREENS.map((screen) => (
                <tr className="border-b border-border/60" key={screen.url}>
                  <td className="py-2 font-mono text-xs">{screen.url}</td>
                  <td className="py-2 text-muted-foreground">{screen.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="まだここに無いもの">
        <Card>
          <p className="text-sm leading-relaxed text-muted-foreground">
            開発の TODO は <span className="font-mono text-foreground">docs/tasks/</span> に
            1タスク1ファイルで置いてあり、
            <span className="text-foreground">git に入れていない（手元だけ）</span>
            ので、この画面からは読めません。出すなら別の持ち方を決める必要があります。
          </p>
        </Card>
      </Section>
    </PageShell>
  );
}
