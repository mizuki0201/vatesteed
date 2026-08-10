import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vatesteed — AI と人間で組み立てる競馬予想エージェント",
  description:
    "膨大なデータを集めて解析する AI と、データに表れない文脈を読む人間。ふたりで競馬の予想を組み立てるエージェントです。",
};

const roles = [
  {
    who: "AI",
    what: "膨大なデータを集めて解析する",
    detail: "全馬の戦績を何年分も追いかけて突き合わせる。人間には量が多すぎる作業を引き受けます。",
  },
  {
    who: "人間",
    what: "データに表れない文脈を読んで解釈を加える",
    detail:
      "この着順は信用していい、これは度外視していい。数字の背後にある経緯や事情を読み取ります。",
  },
] as const;

const steps = [
  {
    title: "自分で調べる",
    body: "枠順や各馬の情報は Vatesteed が自分で集めてきます。取得できないものや判断に迷うものを勝手に埋めることはせず、人間に確認します。",
  },
  {
    title: "分析して、予想する",
    body: "集めた情報から各馬を評価し、レースの展開を読み、着順を予想します。結論だけでなく、なぜそう判断したのかまで一緒に出します。",
  },
  {
    title: "解釈を受け取って、覚える",
    body: "人間から渡された文脈や解釈を蓄積します。ここで溜まるのは単なるデータではなく、人間の解釈を含んだ、Vatesteed にしか無い情報です。",
  },
  {
    title: "振り返って、更新する",
    body: "レースが終わったら、展開や着順の予想がどこまで合っていたかを検証します。各馬、騎手、厩舎、コースなどへの評価を更新し、次に備えます。",
  },
] as const;

const plans = [
  "過去のレースを使ってシミュレーションする",
  "先のビッグレースに向けて、出走が見込まれる馬の展望を分析する",
  "解釈を加える部分を、少しずつ AI 側に寄せていく",
  "ダッシュボードやスマートフォンからも操作できるようにする",
] as const;

const stack = [
  { label: "言語", value: "TypeScript" },
  { label: "エージェント", value: "eve（現在は Claude Code をエンジンとして使用）" },
  { label: "Web", value: "Next.js" },
  { label: "データベース", value: "Neon (Postgres)" },
  { label: "ホスティング", value: "Vercel" },
  { label: "ランタイム", value: "Node.js 24" },
  { label: "パッケージ管理", value: "pnpm" },
] as const;

const links = [
  { label: "note", note: "今後作成予定" },
  { label: "X", note: "今後作成予定" },
] as const;

/** 全体を通して使う一色だけのアクセント。芝の色から取っている。 */
const accent = "text-[oklch(0.5_0.12_155)] dark:text-[oklch(0.74_0.11_155)]";

function SectionHeading({ eyebrow, title }: { readonly eyebrow: string; readonly title: string }) {
  return (
    <header className="mb-10">
      <p
        className={`mb-2 font-mono text-xs tracking-[0.2em] uppercase ${accent}`}
      >
        {eyebrow}
      </p>
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
    </header>
  );
}

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-24 text-foreground">
      {/* ヒーロー */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-32 -z-10 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,oklch(0.58_0.11_155/0.16),transparent_70%)]"
        />
        <p className="mb-6 text-6xl leading-none sm:text-7xl">🐎</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Vatesteed</h1>
          <span
            className={`rounded-full border border-current/40 px-2.5 py-1 font-mono text-xs tracking-[0.2em] uppercase ${accent}`}
          >
            Beta
          </span>
        </div>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground sm:text-xl">
          膨大なデータを集めて解析する AI と、データに表れない文脈を読む人間。
          <br className="hidden sm:inline" />
          ふたりで競馬の予想を組み立てるエージェントです。
        </p>
        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
          🚧 現在は<span className="font-medium text-foreground">β版</span>
          です。開発中のため、機能も構成も予告なく変わります。
        </p>
        <p className="mt-8 max-w-xl rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-card-foreground">名前の由来</span>
          {" — "}
          vates（ラテン語で「預言者」）と steed（駿馬）を組み合わせた名前です。
          <span className="font-medium text-card-foreground">優駿を預言する者</span>
          、という意味を込めています。
        </p>
      </section>

      {/* やりたいこと */}
      <section className="border-t border-border py-16">
        <SectionHeading eyebrow="Concept" title="このアプリでやりたいこと" />
        <div className="space-y-5 leading-relaxed text-muted-foreground">
          <p>
            競馬のデータは、着順、タイム、人気といった「結果」として記録されます。ただそれは起きたことの記録であって、その馬がどれだけ強いか、どんな状態だったかを直接表しているわけではありません。
          </p>
          <p>
            競馬ファンは、そこを補正しながら見ています。数字の背後にある経緯や事情を読み取って、この着順は信用していい、これは度外視していい、と評価を上下させている。
            <span className="font-medium text-foreground">
              この読み取りは、データにした時点でこぼれ落ちます。
            </span>
          </p>
          <p>一方で、全馬の戦績を何年分も追いかけて突き合わせる作業は、人間には量が多すぎます。</p>
          <p className="font-medium text-foreground">そこで役割を分けます。</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {roles.map((role) => (
            <div
              key={role.who}
              className="rounded-2xl border border-border bg-card p-6 text-card-foreground"
            >
              <p className={`font-mono text-xs tracking-[0.2em] uppercase ${accent}`}>{role.who}</p>
              <p className="mt-3 text-lg font-semibold tracking-tight">{role.what}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{role.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* どう実現するか */}
      <section className="border-t border-border py-16">
        <SectionHeading eyebrow="How" title="どう実現するか" />
        <ol className="space-y-4">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-5 rounded-2xl border border-border bg-card p-6 text-card-foreground"
            >
              <span
                className={`shrink-0 font-mono text-2xl leading-none font-semibold tabular-nums ${accent}`}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-lg font-semibold tracking-tight">{step.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-8 leading-relaxed text-muted-foreground">
          この往復を重ねるほど内側の蓄積が厚くなり、外から取ってくる必要は減っていきます。予想は
          note の記事と、このリポジトリで作っているダッシュボードで公開します。
        </p>
      </section>

      {/* 今後の展望 */}
      <section className="border-t border-border py-16">
        <SectionHeading eyebrow="Roadmap" title="今後の展望" />
        <p className="leading-relaxed text-muted-foreground">
          Vatesteed は
          <span className="font-medium text-foreground">レース予想アプリではありません。</span>
          使い道はこれからも増やしていきます。いま考えているのは、たとえばこんなことです。
        </p>
        <ul className="mt-6 space-y-3">
          {plans.map((plan) => (
            <li key={plan} className="flex gap-3 text-muted-foreground">
              <span aria-hidden className={accent}>
                ▸
              </span>
              <span className="leading-relaxed">{plan}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          ここに並べたものは思いついている一例で、これで固定するつもりはありません。
        </p>
      </section>

      {/* 技術基盤 */}
      <section className="border-t border-border py-16">
        <SectionHeading eyebrow="Tech" title="Vatesteed の技術基盤" />
        <p className="mb-8 rounded-xl border border-border bg-muted/60 p-4 text-sm leading-relaxed text-muted-foreground">
          ⚠️ ここから先は開発中の内容を多く含みます。構成は今後変わります。
        </p>
        <div className="space-y-5 leading-relaxed text-muted-foreground">
          <p>
            エージェントフレームワークの <span className="font-medium text-foreground">eve</span>{" "}
            の構成でプロジェクトを作り、
            <span className="font-medium text-foreground">Next.js</span>{" "}
            を同居させてダッシュボードを同じリポジトリに置いています。
          </p>
          <p>
            ツールのロジックはすべて <code className="font-mono text-sm">lib/</code>{" "}
            に集約し、エージェント側とダッシュボード側の両方から同じものを呼びます。エージェントの手順は{" "}
            <code className="font-mono text-sm">agent/skills/</code> にスキルとして置き、eve の{" "}
            <code className="font-mono text-sm">SKILL.md</code> の規約に従います。
          </p>
          <p>
            現時点では eve のランタイムは使用しておらず、
            <span className="font-medium text-foreground">
              Claude Code がエンジンとして <code className="font-mono text-sm">lib/</code>{" "}
              を直接呼ぶ形
            </span>
            で動かしています。
          </p>
        </div>

        <dl className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {stack.map((row) => (
            <div key={row.label} className="flex gap-4 px-6 py-3.5 text-sm">
              <dt className="w-32 shrink-0 text-muted-foreground">{row.label}</dt>
              <dd className="text-card-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* リンク */}
      <section className="border-t border-border py-16">
        <SectionHeading eyebrow="Links" title="もっと知りたい方は" />
        <ul className="grid gap-3 sm:grid-cols-2">
          {links.map((link) => (
            <li
              key={link.label}
              className="rounded-xl border border-dashed border-border px-5 py-4 text-sm"
            >
              <p className="font-medium">{link.label}</p>
              <p className="mt-1 text-muted-foreground">{link.note}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
