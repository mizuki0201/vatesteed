/**
 * 評価テーブルの**保存される列**に入ってはいけない、内部構造を直接表す言葉。
 *
 * かかるのは8テーブルの `body` と、`pedigree_notes` `progeny_notes` の `scope`。どちらも
 * 画面に出る公開値なので、同じ一覧で判定する。**本文専用の判定ではない。**
 *
 * 一覧の正本は
 * [docs/agent-design.md](../../docs/agent-design.md) の
 * 「評価の本文と、返すだけのメモ」。ここはそれを機械が読める形に写したもので、
 * [db/migrations/0011](../../db/migrations/0011_notes_no_internal_terms.sql) の
 * CHECK 制約と同じ判定を JavaScript 側でも行うために置いている。
 *
 * **照合は大文字小文字を区別する。** 評価の本文には英字の馬名・競走名が入る（`Frankel`、
 * `Prix de l'Arc de Triomphe`）。区別せずに照合すると、それらが識別子と重なったときに
 * 正しい本文まで書けなくなる。見るのは、ここに書いたとおりの綴りだけ。
 *
 * **文脈までは判定しない。** ここに並ぶのは、どう読んでも競馬の話にならない言葉だけ。
 * 「未登録」「取れなかった」のように競馬の側の意味（登録抹消、出走登録）と重なる言葉は、
 * 弾くと正しい本文まで書けなくなるので入れていない。そこは分析する役の指示と、書き込む前の
 * 見直しで守る。**この判定は下限であって、通ったから公開してよいという意味ではない。**
 */
export const INTERNAL_TERMS: readonly string[] = [
  // テーブル名
  "courses",
  "races",
  "horses",
  "jockeys",
  "trainers",
  "entries",
  "race_laps",
  "entry_notes",
  "horse_notes",
  "pedigree_notes",
  "progeny_notes",
  "jockey_notes",
  "trainer_notes",
  "course_notes",
  "race_notes",
  "entry_comments",
  "marks",
  "ai_predictions",
  "my_predictions",
  "race_predictions",
  "race_prediction_conditions",
  "ai_bets",
  "ai_bet_legs",
  "my_bets",
  "my_bet_legs",
  "race_payouts",
  "users",

  // 役の名前
  "-analyst",
  "verifier",

  // 列の名前
  "_id",
  "null",
  "NULL",
  "author",
  "scope",
  "created_at",
  "updated_at",
  "corner_positions",

  // 内部の言葉
  "DB",
  "データベース",
  "テーブル",
  "カラム",
  "サブエージェント",
  "オーケストレーター",
  "プロンプト",
  "マイグレーション",
];

/**
 * 上をそのまま `|` で繋いだ選択パターン。
 *
 * **Postgres の `~` と JavaScript の `RegExp` の両方で同じ意味になる形に保つ。** 中身は
 * リテラルの選択だけで、どちらの方言でも特別な意味を持つ文字を含まない（`-` は角括弧の
 * 外なので、どちらでもただの文字）。**特別な意味を持つ文字が要る言葉を足すことになったら、
 * 2つの方言で同じ意味になるかを確かめてから足す。**
 *
 * この文字列は
 * [db/migrations/0011](../../db/migrations/0011_notes_no_internal_terms.sql) の
 * 10個の CHECK 制約（8テーブルの `body` と、`pedigree_notes` `progeny_notes` の `scope`）に
 * そのまま埋め込んである。ずれていないことは単体テストで見ている。
 */
export const INTERNAL_TERM_PATTERN: string = INTERNAL_TERMS.join("|");

/**
 * 保存する値に入っている内部の言葉を、{@link INTERNAL_TERMS} の並び順で重複なく返す。
 *
 * **`body` と `scope` のどちらにも同じように使う。** 見るのは文字列だけで、どの列の値かは
 * 問わない。
 *
 * 1つも無ければ空配列。**空配列が返ることは、その値を公開してよいことの証明ではない**
 * （{@link INTERNAL_TERMS} を参照）。
 */
export function findInternalTerms(value: string): readonly string[] {
  return INTERNAL_TERMS.filter((term) => value.includes(term));
}
