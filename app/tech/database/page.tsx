import type { Metadata } from "next";
import { Card, PageShell, Section } from "@/components/screens/page-shell";

export const metadata: Metadata = { title: "DB 設計 — Vatesteed" };

/**
 * DB 設計。**静的な画面。** 実際のスキーマ（`db/schema.sql`）を写して手で書いている。
 *
 * スキーマを変えたら、ここと `UPDATED_ON` も直す。**直し忘れても分かるように日付を出す。**
 */
const UPDATED_ON = "2026-08-17";

type Table = {
  readonly name: string;
  readonly what: string;
  readonly columns: readonly string[];
  /** 1対象1行の上書きになっているものに印を付ける。 */
  readonly unique?: string;
};

type Group = {
  readonly heading: string;
  readonly what: string;
  readonly tables: readonly Table[];
};

const GROUPS: readonly Group[] = [
  {
    heading: "土台",
    what: "事実だけを入れる。解釈は入れない",
    tables: [
      {
        name: "courses",
        what: "コース。競馬場・芝ダート・距離・内外で1つ",
        columns: ["track", "surface", "distance_m", "turn", "layout"],
        unique: "(track, surface, distance_m, layout)",
      },
      {
        name: "races",
        what: "レース1つ",
        columns: [
          "race_date",
          "course_id →courses",
          "meeting_number",
          "meeting_day",
          "race_number",
          "race_name",
          "grade",
          "weight_rule",
          "weather_forecast",
          "track_condition",
          "weather",
        ],
        unique: "(race_date, course_id, race_number)",
      },
      {
        name: "horses",
        what: "馬。父母を自分自身で指すので血統を遡れる",
        columns: [
          "name",
          "name_kana",
          "birth_year",
          "sex",
          "sire_id →horses",
          "dam_id →horses",
          "trainer_id →trainers",
        ],
      },
      {
        name: "jockeys",
        what: "騎手",
        columns: ["name", "name_kana", "birth_year", "debut_year", "affiliation"],
      },
      {
        name: "trainers",
        what: "調教師",
        columns: ["name", "name_kana", "opened_on", "affiliation"],
      },
      {
        name: "entries",
        what: "出走。ある馬がある1つのレースに出た分",
        columns: [
          "race_id →races",
          "horse_id →horses",
          "jockey_id →jockeys",
          "trainer_id →trainers（当時の厩舎）",
          "bracket_number",
          "horse_number",
          "weight_carried",
          "status",
          "finish_position",
          "popularity",
          "win_odds",
          "finish_time_ms",
          "last_3f_ms",
          "corner_positions",
          "body_weight",
          "body_weight_diff",
          "margin",
        ],
        unique: "(race_id, horse_id) と (race_id, horse_number)",
      },
    ],
  },
  {
    heading: "評価",
    what: "解釈を入れる。8つとも形は同じで、対象が違うだけ。1対象1行の上書きで履歴は持たない",
    tables: [
      {
        name: "entry_notes",
        what: "ある出走で何が起きたか",
        columns: ["entry_id →entries", "body", "author"],
        unique: "entry_id",
      },
      {
        name: "horse_notes",
        what: "どういう馬か。AI と人間の対話で作る",
        columns: ["horse_id →horses", "body", "author"],
        unique: "horse_id",
      },
      {
        name: "pedigree_notes",
        what: "その馬自身の血統から読める適性の素地",
        columns: ["horse_id →horses", "body", "scope（何代まで見たか）", "author"],
        unique: "horse_id",
      },
      {
        name: "progeny_notes",
        what: "その馬の産駒の傾向。種牡馬・繁殖牝馬としての話",
        columns: ["horse_id →horses", "body", "scope（どの範囲の産駒を見たか）", "author"],
        unique: "horse_id",
      },
      {
        name: "jockey_notes",
        what: "騎手の乗り方",
        columns: ["jockey_id →jockeys", "body", "author"],
        unique: "jockey_id",
      },
      {
        name: "trainer_notes",
        what: "厩舎の仕上げ方",
        columns: ["trainer_id →trainers", "body", "author"],
        unique: "trainer_id",
      },
      {
        name: "course_notes",
        what: "コースの傾向",
        columns: ["course_id →courses", "body", "author"],
        unique: "course_id",
      },
      {
        name: "race_notes",
        what: "レースの評価。走ったあと",
        columns: ["race_id →races", "body", "author"],
        unique: "race_id",
      },
    ],
  },
  {
    heading: "コメント",
    what: "騎手と陣営が述べたことの記録。評価と違って上書きせず、発言のたびに1行ずつ溜まる",
    tables: [
      {
        name: "entry_comments",
        what: "誰が・いつ・レースのどちら側で・何を述べたか。述べた内容が本当かどうかは別",
        columns: [
          "entry_id →entries",
          "race_phase（レース前 / レース後）",
          "speaker_role",
          "speaker_name",
          "spoken_on",
          "summary（400字まで）",
          "interpretation（読み取った含意）",
          "source",
          "author",
        ],
      },
    ],
  },
  {
    heading: "予想",
    what: "走る前に出したもの。AI と自分を分けて持つ",
    tables: [
      {
        name: "marks",
        what: "印のマスタ。日本語と記号を同じ行に持つ",
        columns: ["name（本命）", "symbol（◎）", "sort_order"],
      },
      {
        name: "ai_predictions",
        what: "AI が付けた印",
        columns: ["entry_id →entries", "mark_id →marks", "rationale", "predicted_at"],
        unique: "entry_id",
      },
      {
        name: "my_predictions",
        what: "自分が付けた印",
        columns: ["entry_id →entries", "mark_id →marks", "rationale", "predicted_at"],
        unique: "entry_id",
      },
      {
        name: "race_predictions",
        what: "展開の見立て。AI と人間が対話で作るので1つ",
        columns: ["race_id →races", "body", "author", "predicted_at"],
        unique: "race_id",
      },
    ],
  },
  {
    heading: "購入",
    what: "馬券は実際には買わず、記録だけ残して回収率を測る。買い目は「列」で持つ",
    tables: [
      {
        name: "ai_bets",
        what: "AI の買い目1本",
        columns: [
          "race_id →races",
          "ticket_type",
          "bet_style",
          "is_multi",
          "unit_amount",
          "combination_count",
          "total_amount",
          "payout",
          "refund",
        ],
      },
      {
        name: "ai_bet_legs",
        what: "その買い目の列。何列目に誰を置いたか",
        columns: ["ai_bet_id →ai_bets", "leg_group（何列目）", "entry_id →entries", "bracket_number"],
        unique: "(ai_bet_id, leg_group, entry_id, bracket_number)",
      },
      {
        name: "my_bets",
        what: "自分の買い目1本",
        columns: ["ai_bets と同じ形"],
      },
      {
        name: "my_bet_legs",
        what: "その列",
        columns: ["ai_bet_legs と同じ形"],
      },
    ],
  },
  {
    heading: "確定払戻",
    what: "レースの公式な払戻。自分の買い目がいくら戻ったか（ai_bets.payout）とは別のもの",
    tables: [
      {
        name: "race_payouts",
        what: "そのレースの払戻。100円あたりの金額",
        columns: [
          "race_id →races",
          "ticket_type",
          "combination（当たった組み合わせ）",
          "amount",
          "popularity",
        ],
        unique: "(race_id, ticket_type, combination)",
      },
    ],
  },
  {
    heading: "閲覧権限",
    what: "作ってあるが、Phase 1 では参照していない",
    tables: [
      {
        name: "users",
        what: "誰がどこまで見られるか",
        columns: ["email", "access_level", "grant_source"],
        unique: "email",
      },
    ],
  },
];

const RULES: readonly string[] = [
  "ORM を使わず、SQL を手で書いて流す。マイグレーションは db/migrations/ に置いて順に当てる",
  "評価は1対象1行の上書き。履歴のテーブルを作らない代わりに、誰が書いたか（author）を必ず持つ",
  "author は AI / 人間 / 対話 の3つ。AI が人間の行を塗り潰さないための目印になっている",
  "買い目は展開した結果を保存しない。列（leg_group）さえあれば何度でも同じ組み合わせが出る",
  "updated_at は DB のトリガーで自動更新する。アプリ側で入れ忘れても狂わない",
];

export default function Page() {
  const tableCount = GROUPS.reduce((sum, group) => sum + group.tables.length, 0);

  return (
    <PageShell
      back={{ href: "/tech", label: "技術情報" }}
      lead={
        <>
          {tableCount} テーブル。→ が付いている列は、その先のテーブルを指しています。
          <span className="ml-1 text-foreground">最終更新 {UPDATED_ON}</span>
        </>
      }
      title="DB 設計"
    >
      {GROUPS.map((group) => (
        <Section key={group.heading} note={group.what} title={group.heading}>
          <div className="grid gap-3 md:grid-cols-2">
            {group.tables.map((table) => (
              <Card className="h-full" key={table.name}>
                <p className="font-mono text-sm font-semibold">{table.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{table.what}</p>
                <ul className="mt-3 space-y-0.5">
                  {table.columns.map((column) => (
                    <li className="font-mono text-xs text-foreground/80" key={column}>
                      {column}
                    </li>
                  ))}
                </ul>
                {table.unique ? (
                  <p className="mt-3 font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
                    一意: {table.unique}
                  </p>
                ) : null}
              </Card>
            ))}
          </div>
        </Section>
      ))}

      <Section title="決めていること">
        <ul className="space-y-2">
          {RULES.map((rule) => (
            <li key={rule}>
              <Card>
                <p className="text-sm leading-relaxed text-muted-foreground">{rule}</p>
              </Card>
            </li>
          ))}
        </ul>
      </Section>
    </PageShell>
  );
}
