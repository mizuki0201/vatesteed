# データモデル

2026-08-08 のブレストで、スキーマの叩き台まで作った。2026-08-09 に
[db/migrations/0001_initial.sql](../db/migrations/0001_initial.sql) として書き起こしてある。
**このドキュメントがスキーマの正本で、SQL はそれを流すためのもの。** ORM は使わない
（[decisions/0004](decisions/0004-migrations-without-orm.md)）。

**2026-08-09 に本番へ適用済み**（`migration-test` ブランチで通してから流した）。22テーブル。

このドキュメントは**何をどう持つか（設計）**の正本で、**今DBに何があるか**は
[db/schema.sql](../db/schema.sql) を見る。あちらは `pnpm db:migrate` が毎回書き出す生成物
なので、手で編集しない。テーブルの今の形を知りたいだけならあれを読むのが速い。

用語は次の4つで統一する。

| 言葉 | 意味 |
| --- | --- |
| レース | 2026年 宝塚記念、のような1つのレース |
| 出走 | ある馬がある1レースに出た分。「タバルの2025年有馬記念」 |
| 評価 | 書いた文章。事実も読み取りも混ぜて1つ |
| 馬の情報 | 特定のレースに紐づかない、その馬全体の話 |

---

## 確定していること

### DB の分け方

- DBインスタンスは1つ。テーブルで分ける
- **AI の予想・購入** と **自分の予想・購入** は別テーブル（`ai_` と `my_` が1対1で対応する）
- 自分の購入はエージェントの学習に自動反映しない。反映したいと判断したときだけ、明示的に
  スキルを叩いて評価を更新する

背景は [architecture.md](architecture.md#データベース) を参照。

### ナレッジの型

- **出走ごとの評価は保存する実体。** 書かれるのはそのレースの直後で、次の予想のときに作り直すのではない
- **事実と読み取りは分けず、1つの文章にまとめる**
- 過去の出来事についての評価なので、後から変わることは少ない。ただし変わることもある
- **間違っていたもの・修正されたものは残さない。** 上書きで、履歴は持たない。DBには正しいものだけを置く
- **書き手はAIと人間の両方。** AIが取れる情報はAIが取り、人間が補う。誰が書いたかは `author` で区別する。
  **`author` は表示のためだけの列ではない。** 人間や対話が書いた行を AI が単独で上書きしないための
  判別に使う（[product.md](product.md#人間の読みは勝手に上書きしない)）
- **馬の情報はAIと人間の対話で作る。** AIが過去の出走の評価を読んで案を出し、人間がすり合わせて
  結論を残す。やり取りの過程は残さない
- 「今は充実期」のように時間が経つと古くなる内容があるため、`updated_at` で「いつ時点の話か」を持つ
- **レース当日の情報は、予想する時点で分かっているものだけ持つ。** 予想は枠順確定直後に行うため、
  枠順・出走メンバー・天気予報は持ち、当日馬体重とパドックは持たない
- 実際の馬場状態・天気・着順・レース内容は、**レース後の評価を書くために必要**なので保存する

蓄積型 / 都度取得型の区別そのものは [architecture.md](architecture.md#ナレッジの性質) を参照。

### ID体系

**馬・騎手・レースとも、自前の連番（`bigserial`）で識別する。**

外部の識別子（血統登録番号など）は使わない。JRA-VAN は商用利用不可で、他サイトからの取得は
[compliance.md](compliance.md) の方針で自動収集にあたるため、**確実に取得できる経路が無い**。
後から必要になったらカラムを1本足すだけで済む。

### テーブル一覧（22）

| 分類 | テーブル |
| --- | --- |
| 土台（6） | `courses` `races` `horses` `jockeys` `trainers` `entries` |
| 評価（7） | `entry_notes` `horse_notes` `pedigree_notes` `jockey_notes` `trainer_notes` `course_notes` `race_notes` |
| 予想（4） | `marks` `ai_predictions` `my_predictions` `race_predictions` |
| 購入（4） | `ai_bets` `ai_bet_legs` `my_bets` `my_bet_legs` |
| 閲覧権限（1） | `users` |

中心は `entries`（出走）。1行が「ある馬がある1レースに出た分」にあたり、馬とレースを繋いでいる。

### データの入れ方

**初期の一括投入（seed）は行わない。運用を回しながら1件ずつ登録していく。**

- 始めのうちは1レースぶんの18頭を全部分析し、騎手や厩舎も併せて登録することになるため、
  **かなり忙しくなる**
- ただし馬・騎手・厩舎・コース・血統は**使い回せる**ので、回すほど新規登録は減って楽になる
- したがって、**始めから全部を完璧にやるつもりはない。** できる範囲で蓄積する

この前提は容量の見積もりにも効く。[architecture.md](architecture.md#ストレージ見積もり) の
「馬プロファイルの更新 1万頭 × 年5回」は全頭を機械的に更新する想定の数字だが、実際には
**対話した馬の分しか増えない**ため、これよりかなり小さくなる。

---

## 土台

### `courses`

| カラム | 型 | 内容 |
| --- | --- | --- |
| `id` | bigserial | PK |
| `track` | text | 競馬場。阪神 |
| `surface` | text | 芝 / ダート / 障害 |
| `distance_m` | int | 2200 |
| `turn` | text | 右 / 左 / 直線 |
| `layout` | text | 内 / 外。区別が無いコースは null |
| `created_at` `updated_at` | timestamptz | |

`layout` は京都芝1400のように同じ距離で内・外の両方が存在するため必要。

- UNIQUE: `(track, surface, distance_m, layout)`。同じコースを二重に登録すると評価が
  二手に分かれて静かに壊れるため塞ぐ

### `races`

| カラム | 型 | 内容 |
| --- | --- | --- |
| `id` | bigserial | PK |
| `race_date` | date | |
| `course_id` | bigint | FK → `courses` |
| `meeting_number` | int | 開催回。海外・地方は null |
| `meeting_day` | int | 日目。海外・地方は null |
| `race_number` | int | 11R |
| `race_name` | text | JRA正式名称のみ。条件戦は null |
| `grade` | text | G1 など |
| `weight_rule` | text | 馬齢 / 別定 / 定量 / ハンデ |
| `weather_forecast` | text | 予想時点の天気予報。「曇のち雨」。自由記述 |
| `track_condition` | text | レース後 |
| `weather` | text | レース後 |
| `created_at` `updated_at` | timestamptz | |

**レース名の表記揺れはDBに入れない。** 「宝塚の」「春天」のような呼び方は、エージェント側の
md マスタで正式名称に直してからSQLを投げる（下記「レース名の扱い」）。

**海外・地方のビッグレースも対象に含める。** 「第3回8日目」のような開催情報が無いため null 可。

- UNIQUE: `(race_date, course_id, race_number)`。同じレースの二重登録を塞ぐ

### `horses`

| カラム | 型 | 内容 |
| --- | --- | --- |
| `id` | bigserial | PK |
| `name` | text | メイショウタバル |
| `name_kana` | text | |
| `birth_year` | int | |
| `sex` | text | 牡 / 牝 / セン |
| `sire_id` | bigint | 父。FK → `horses`。null 可 |
| `dam_id` | bigint | 母。FK → `horses`。null 可 |
| `trainer_id` | bigint | 現在の所属。FK → `trainers`。null 可 |
| `created_at` `updated_at` | timestamptz | |

**父・母のFKが null 可なのは、血統をどこかで遡り終える必要があるため。** 打ち切った先の馬は
指す相手がいない。自己参照にしてあるので、全兄弟の検索ができる。

**母父のカラムは持たない。** 母をたどれば父が分かるため（`dam_id` → その馬の `sire_id`）。
5〜6世代を遡る前提なので、母は基本的に登録されている。

**`name` 以外はすべて null 可。** 血統をたどるためだけに登録する先祖馬には厩舎が無く、生年も
分からないことがある。ステイゴールドを登録するのに厩舎の登録を強制されると詰まる。

**`name` に UNIQUE は張らない。** 競走馬名は引退から一定期間が経つと再使用できるため、
5〜6世代を遡ると同名の別馬に当たりうる。一意にするとその瞬間に登録できなくなる。
代わりに索引だけ張ってあるので、**登録の前に名前で検索して、居なければ作る**という手順が要る。
これはスキーマではなく分析手順（skill）側で守る。

### `jockeys`

| カラム | 型 | 内容 |
| --- | --- | --- |
| `id` | bigserial | PK |
| `name` `name_kana` | text | 武豊 |
| `birth_year` | int | |
| `debut_year` | int | |
| `affiliation` | text | 美浦 / 栗東 / 地方 / 外国 |
| `created_at` `updated_at` | timestamptz | |

### `trainers`

| カラム | 型 | 内容 |
| --- | --- | --- |
| `id` | bigserial | PK |
| `name` `name_kana` | text | |
| `opened_on` | date | 開業日 |
| `affiliation` | text | 美浦 / 栗東 / 地方 / 外国 |
| `created_at` `updated_at` | timestamptz | |

### `entries`

| カラム | 型 | 内容 | いつ埋まるか |
| --- | --- | --- | --- |
| `id` | bigserial | PK | |
| `race_id` | bigint | FK → `races` | 枠順確定時 |
| `horse_id` | bigint | FK → `horses` | 枠順確定時 |
| `jockey_id` | bigint | FK → `jockeys` | 枠順確定時 |
| `trainer_id` | bigint | **当時の厩舎。** FK → `trainers` | 枠順確定時 |
| `bracket_number` | int | 枠番 | 枠順確定時 |
| `horse_number` | int | 馬番。null 可 | 枠順確定時 |
| `weight_carried` | numeric(4,1) | 斤量 | 枠順確定時 |
| `status` | text | 出走 / 取消 / 除外 / 中止 / 失格 | |
| `finish_position` | int | 着順。降着があれば**降着後の確定着順** | レース後 |
| `popularity` | int | 人気 | レース後 |
| `win_odds` | numeric(6,1) | 単勝オッズ | レース後 |
| `finish_time_ms` | int | 走破時計 | レース後 |
| `last_3f_ms` | int | 上がり3F | レース後 |
| `corner_positions` | text | 通過順「1-1-2-4」 | レース後 |
| `created_at` `updated_at` | timestamptz | | |

- UNIQUE: `(race_id, horse_id)` と `(race_id, horse_number)`
- 着順が入るのは `status = '出走'` のときだけ。これは CHECK 制約で縛っている
- **人気・オッズには同じ縛りをかけない。** 中止・失格の馬にも人気とオッズは存在する
- **`trainer_id` を出走にも持たせるのは転厩があるため。** 馬の現在の所属だけだと、厩舎別の
  成績が過去にさかのぼって狂う
- **騎手・厩舎・枠番・馬番・斤量は null 可。** 枠順確定時に埋まる前提だが、海外レースには枠番の
  概念が無い場合がある。中央だけ厳しくする手が無いので、緩い側に寄せている
- **馬番を null 可にしたのは、過去の出走を後から登録するため**（2026-08-15、
  [0002](../db/migrations/0002_entries_horse_number_nullable.sql)）。予想対象のレースは
  枠順確定後に登録するので必ず埋まるが、**過去の出走は情報源によっては馬番が取れない**。
  `UNIQUE (race_id, horse_number)` はそのまま残してあり、Postgres は既定で null を互いに
  異なる値として扱うので、馬番の分からない出走が同じレースに複数あっても弾かれない

### レース名の扱い

DBには JRA 正式名称だけを入れる。呼び方の揺れは**エージェント側の md マスタ**で吸収する。

```
人間「春天の予想して」
  → AI が md マスタで正式名称「天皇賞(春)」を特定
  → その正式名称で SQL を投げる
```

DB側に別名のテーブルは持たない。マスタは JRA の正式名称で管理する。

#### 表記ルール

`race_name` はただのテキストなので、**1文字でも違うと別のレースとして扱われる**。別名マスタも
「春天 → 正式名称」を引く仕組みである以上、引き先が1つに決まっていないと成立しない。
そのため、揺れうる箇所の文字種を固定する。

| 項目 | ルール | 例 |
| --- | --- | --- |
| 括弧 | **半角** `( )` | `天皇賞(春)` |
| 数字 | **半角** | `2歳ステークス` |
| 英字 | **半角**。略さず正式名称で書く | `ホープフルステークス`（`ホープフルS` にしない） |
| 空白 | 入れない | |

半角に寄せるのは、入力時に揺れにくく比較も速いため。**どちらでも動くが、片方に固定することが
本質。**

**注意:** JRA 公式サイトのレース名は全角括弧で書かれている。公式ページから写すと全角が混ざるため、
**登録時に半角へ正規化する処理が要る**（[agent-design.md](agent-design.md#lib-に必要になるロジックメモ) 参照）。

---

## 評価

7テーブルとも同じ形。**対象 + 内容 + 書いた人 + 更新日。**

| テーブル | 対象（一意） | 例 |
| --- | --- | --- |
| `entry_notes` | `entry_id` | 向正面で強引にハナを取り返して消耗した。着順で能力をマイナス評価する必要はない |
| `horse_notes` | `horse_id` | 阪神は問題ない。武豊と手が合う。今は充実期 |
| `pedigree_notes` | `horse_id` | ゴールドシップ産駒なので2500もこなす |
| `jockey_notes` | `jockey_id` | ペース作りがうまい |
| `trainer_notes` | `trainer_id` | 叩き2走目で仕上げてくる |
| `course_notes` | `course_id` | 東京芝2000は差し有利 |
| `race_notes` | `race_id` | 前半が速く先行勢に厳しかった。**レース後の評価** |

共通カラムは `id` / 対象のFK（一意）/ `body` (text) / `author` (text) / `created_at` / `updated_at`。
`pedigree_notes` だけ `scope` を持つ。

- **1つの対象につき1行。** 書き直しは上書きで、履歴のテーブルは作らない
- `race_notes` は**レース後**の評価。予想時点の展開の見立ては `race_predictions`（別テーブル）
- **馬と騎手の相性**（「武豊と手が合う」）は `horse_notes` の文中で扱う。専用のテーブルは作らない
- `pedigree_notes.scope` は「6代」「6代+全兄弟」のような自由記述。**5〜6世代を遡るのはマスト、
  兄弟系は任意**という基準は、スキーマではなく分析手順（skill）側に置く

7テーブルに分けたまま作る。統合案を見送った経緯は
[decisions/0002-note-tables-per-target.md](decisions/0002-note-tables-per-target.md)。

### 評価が書かれるきっかけ

2つある。どちらから書いても同じ行を上書きするだけなので、スキーマ側に足すものは無い。

- **レース後** — 必ず起きる。走るたびに一度
- **予想の会話の中** — 話していて決まったとき

**誰が書き込むかは評価の性質で分ける。** 大量に発生して機械的に決まるもの（`entry_notes`）は
分析する役が直接書き、対話で結論を出すと決めたもの（`horse_notes`）はオーケストレーターを
通す。詳細は [agent-design.md](agent-design.md#評価を誰が書き込むか2026-08-11-決定)。

---

## 予想

### `marks`

印のマスタ。**日本語と記号を同じ行に持つ**ので、「◎」と言われても「本命」と言われても
同じ行にたどり着く。

| `id` | `name` | `symbol` | `sort_order` |
| --- | --- | --- | --- |
| 1 | 本命 | ◎ | 1 |
| 2 | 対抗 | ◯ | 2 |
| 3 | 単穴 | ▲ | 3 |
| 4 | 連下 | △ | 4 |
| 5 | 大穴 | ☆ | 5 |
| 6 | 消し | ー | 6 |

印だけテーブルにするのは、**記号と並び順という値以外の情報がぶら下がるため**。他の値
（馬場状態・券種など）にはそれが無いので CHECK制約で足りる。

### `ai_predictions` / `my_predictions`

馬ごとの印。AIと自分で別テーブル。**回収率をそれぞれ別に測るため。**

| カラム | 型 | 内容 |
| --- | --- | --- |
| `id` | bigserial | PK |
| `entry_id` | bigint | 一意。FK → `entries` |
| `mark_id` | bigint | FK → `marks`。**無印は null** |
| `rationale` | text | 印を付けた理由 |
| `predicted_at` | timestamptz | 枠順確定後に出した時刻 |
| `created_at` `updated_at` | timestamptz | |

### `race_predictions`

レースごとの展開予想。**AIと人間が対話で考えるので1テーブル。** AIのみになることはあるが、
人間のみになることはない。

| カラム | 型 | 内容 |
| --- | --- | --- |
| `id` | bigserial | PK |
| `race_id` | bigint | 一意。FK → `races` |
| `body` | text | ハナはコスモキュランダ。前半が速くなると差し有利 |
| `author` | text | AI / 対話。**人間のみは入らない** |
| `predicted_at` | timestamptz | |
| `created_at` `updated_at` | timestamptz | |

### 予想と回収率

- 予想は**枠順確定直後**に出す。記事にするのもこの予想
- **回収率も枠順確定後の予想で測る。** 記事に出した内容と成績を一致させるため
- 直前に印が動くことはあるが、**それは自分の予想の話なので記録しない**

---

## 購入

馬券は実際には買わず、購入の記録だけ残して回収率を計測する（[agent-design.md](agent-design.md)）。

### `ai_bets` / `my_bets`

| カラム | 型 | 内容 |
| --- | --- | --- |
| `id` | bigserial | PK |
| `race_id` | bigint | FK → `races`。**WIN5 のときだけ null** |
| `ticket_type` | text | 券種 |
| `bet_style` | text | 単点 / ボックス / 流し / フォーメーション |
| `is_multi` | boolean | マルチ。馬単・3連単以外は false |
| `unit_amount` | int | 1点あたりの金額。100円単位 |
| `combination_count` | int | 点数 |
| `total_amount` | int | `unit_amount × combination_count` |
| `payout` | int | 払戻。レース後 |
| `refund` | int | 取消・除外による返還。レース後 |
| `created_at` `updated_at` | timestamptz | |

`combination_count` と `total_amount` は導出値。**`expandBet` の計算結果だけを入れ、手では入れない。**

- CHECK: `race_id` が null でいいのは `ticket_type = 'WIN5'` のときだけ
- CHECK: `is_multi` を true にできるのは馬単・3連単だけ
- CHECK: `unit_amount` は100円単位

### `ai_bet_legs` / `my_bet_legs`

| カラム | 型 | 内容 |
| --- | --- | --- |
| `id` | bigserial | PK |
| `ai_bet_id` / `my_bet_id` | bigint | FK |
| `leg_group` | int | **何列目か** |
| `entry_id` | bigint | FK → `entries`。枠連のときは null |
| `bracket_number` | int | 枠番。枠連のときだけ |
| `created_at` | timestamptz | |

- CHECK: `entry_id` と `bracket_number` はどちらか一方だけが入る
- UNIQUE: `(bet_id, leg_group, entry_id, bracket_number)`。**必ず片方が null になるので、
  `NULLS NOT DISTINCT` を付けて null 同士も同じ値として扱わせないと重複を弾けない**
  （Postgres は既定では null を互いに異なる値として扱う）

### 買い目の持ち方

**すべての買い方を「列」だけで表す。** `bet_style` は人間が読むためのラベルで、計算には使わない。
**列の数は券種が必要とする頭数**と同じ（単勝1・馬連2・3連複3）。

| 買い方 | 3連複での列の埋め方 |
| --- | --- |
| 単点 | 各列に1頭ずつ |
| フォーメーション | 列ごとに指定どおり |
| 軸1頭流し（軸=1、相手=2,3,4,5） | 列1={1}、**列2と列3の両方に {2,3,4,5}** |
| ボックス（1,2,3,4） | **3列すべてに {1,2,3,4}** |

WIN5 は `leg_group` を「対象5レースの発走順で1〜5」として使い、各レースで選んだ馬を並べる。

展開した買い目そのものは保存しない。列さえあれば何度でも同じ結果が出る。経緯は
[decisions/0003-bet-legs-as-columns.md](decisions/0003-bet-legs-as-columns.md)。

### 展開の計算

1. 各列から1つずつ選ぶ全組み合わせを作る
2. **同じ馬が2回出るものを捨てる。** ただし枠連はゾロ目があるので捨てない（ボックスを除く）
3. **マルチなら、各組み合わせの並べ替えをすべて加える**
4. 順不同の券種（枠連・馬連・ワイド・3連複）は、顔ぶれが同じものを1点にまとめる

3連複フォーメーション `1 − 2,3 − 2,3,4,5,6` なら 7点になる。

### 的中の判定

同着があると着順の数字は飛ぶ（1着同着なら `1, 1, 3` で2着が存在しない）。これを前提にすると、
**券種ごとの分岐がほぼ要らなくなる。**

> **買った馬を着順の小さい順に並べたとき、i番目の馬の着順が i 以下であること。**

順序を問う券種（馬単・3連単）は並べ替えず、買った順のまま同じ条件を見る。JRA が公表している
同着の例（1着2頭同着なら3連複「1着−1着−3着」が的中、3着同着なら「1着−3着−3着」は不的中）と
一致することを確認済み。

複勝とワイドだけは「n着以内に入っていればいい」型なので別。買った馬すべての着順が上限以下かを見る。

- **複勝の上限は出走頭数で変わる。** 8頭以上なら3着、7頭以下なら2着（4頭以下は発売なし）
- **ワイドは常に3着まで。** 出走頭数による縮小があるかは JRA 公式に記載を見つけられなかったが、
  常に3着として扱うと決めた（2026-08-09）

回収率は `(payout + refund) ÷ total_amount` で出す。

**枠連だけは共通の規則をそのままは当てられない。** 買った対象が馬ではなく枠のため。
「1着・2着になりうる馬の組」を共通の規則で先に出してから、その枠の組に買った組が含まれるかを
見る。ゾロ目（同じ枠の2頭）もこれで自然に通る。

実装は [lib/bets/](../lib/bets/)。

---

## 閲覧権限

### `users`

`viewer_grants` から改名。Phase 1 では作るだけで参照しない。

| カラム | 型 | 内容 |
| --- | --- | --- |
| `id` | bigserial | PK |
| `email` | text | 一意。ログインの識別子 |
| `access_level` | text | owner / friend / member / public |
| `grant_source` | text | owner / manual / note |
| `created_at` `updated_at` | timestamptz | |

`grant_source` は画面判定に使わない。将来 note のメンバー一覧CSVを同期する際、
`grant_source = 'note'` の行だけを洗い替えるために必要（`manual` の友達を巻き込んで消す事故を防ぐ）。

---

## テーブルをまたぐ決まり

### 消したときの挙動（外部キー）

2階建てにしている。

- **参照（マスタを指している）→ `RESTRICT`。** 子が居る親は消せない
- **所有（親が消えたら存在意義がない）→ `CASCADE`。** 親と一緒に消える

| 種類 | 対象 |
| --- | --- |
| RESTRICT | `races.course_id` / `entries` の全FK / `horses.sire_id` `dam_id` `trainer_id` / `*_predictions.mark_id` / `*_bets.race_id` / `*_bet_legs.entry_id` |
| CASCADE | 評価7テーブルの対象FK / `*_predictions.entry_id` / `race_predictions.race_id` / `*_bet_legs` の bet へのFK |

**`entries.race_id` を CASCADE にしていないのが要点。** CASCADE にするとレースを1行消しただけで
出走 → 出走ごとの評価 → 予想 → 買い目まで一気に消える。手で書いた評価が巻き添えで消えるのが
最悪の事故なので、レースを消すには先に出走を消させる。消したいときに二段階になる代わりに、
うっかりでは消えない。

`*_bet_legs.entry_id` を RESTRICT にしているので、**買い目に入っている出走は消せない**
（収支データが壊れるため）。

### `updated_at` は DB のトリガーで自動更新する

UPDATE 文に `updated_at = now()` を書き忘れると「いつ時点の話か」という前提が壊れるが、
**人間と AI の両方が手で SQL を書く前提なので書き忘れは起きる**。DB 側で担保している。

`ai_bet_legs` / `my_bet_legs` は `created_at` しか持たないので対象外。

### インデックス

**張るのは引く動線がはっきりしているものだけ。** データが1件も無い状態で性能を予測して張るのは
当てずっぽうになるので、遅いと感じてから足す。

| テーブル | 列 | 理由 |
| --- | --- | --- |
| `entries` | `horse_id` `jockey_id` `trainer_id` | 「この馬の過去走を全部」がこのシステムの中心の問い合わせ |
| `races` | `race_date` `course_id` | 日付で引く / コース別を見る |
| `horses` | `sire_id` `dam_id` `trainer_id` | 産駒・全兄弟・管理馬 |
| `horses` `jockeys` `trainers` | `name` | 登録時に「もう居るか」を名前で探す |
| `ai_bets` `my_bets` | `race_id` | |

評価7テーブルと予想の対象FKは UNIQUE 制約が索引を兼ねるので張らない。`entries.race_id` も
`(race_id, horse_id)` の先頭列で引ける。

---

## 入っていい値

**enum型は使わず、`text` + CHECK制約で縛る。** enum は値の削除と並べ替えができないため。
マスタテーブルにしないのは、変わらない値に JOIN が重いため。**印だけは記号と並び順が
ぶら下がるので `marks` テーブル**にしている。

TypeScript から使う写しは [lib/enums/](../lib/enums/) にある。**正本はこの表と DB の CHECK で、
あちらは写し。** 片方だけ直すとズレるので、`lib/enums/enums.test.ts` が
[db/schema.sql](../db/schema.sql) と突き合わせて落とすようにしてある。

| カラム | 入っていい値 | テーブル |
| --- | --- | --- |
| `surface` | 芝 / ダート / 障害 | `courses` |
| `turn` | 右 / 左 / 直線 | `courses` |
| `layout` | 内 / 外（区別が無いコースは null） | `courses` |
| `grade` | G1 / G2 / G3 / J.G1 / J.G2 / J.G3 / Jpn1 / Jpn2 / Jpn3 / OP / L / 3勝 / 2勝 / 1勝 / 新馬 / 未勝利 | `races` |
| `weight_rule` | 馬齢 / 別定 / 定量 / ハンデ | `races` |
| `track_condition` | 良 / 稍重 / 重 / 不良 | `races` |
| `weather` | 晴 / 曇 / 小雨 / 雨 / 小雪 / 雪 | `races` |
| `sex` | 牡 / 牝 / セン | `horses` |
| `affiliation` | 美浦 / 栗東 / 地方 / 外国 | `jockeys` `trainers` |
| `status` | 出走 / 取消 / 除外 / 中止 / 失格 | `entries` |
| `author` | AI / 人間 / 対話（`race_predictions` は AI / 対話 のみ） | 評価7テーブル、`race_predictions` |
| `ticket_type` | 単勝 / 複勝 / 枠連 / 馬連 / 馬単 / ワイド / 3連複 / 3連単 / WIN5 | `ai_bets` `my_bets` |
| `bet_style` | 単点 / ボックス / 流し / フォーメーション | `ai_bets` `my_bets` |
| `access_level` | owner / friend / member / public | `users` |
| `grant_source` | owner / manual / note | `users` |

`weather_forecast` は自由記述なので CHECK を付けない。

`text` に文字数の上限は無く（1フィールド最大1GB）、`varchar(n)` との性能差も無い。数万文字でも
問題にならないので、長文が入るカラムはすべて `text` にしている。

---

## 見送ったもの

**予想の公開タイミングを時刻の2カラム（`published_at` / `public_at`）で持つ案。**

「member には直後、一般には結果確定後」を時間で表現する案として `data-model.md` に書かれていたが、
**AI側が勝手に出した提案であって合意されたものではない**ため取り下げた。有料化を実際に進める
段階になったら、そのとき改めて検討する。

---

## 未確定事項

**勝手に確定させないこと。**

- `lib/` の切り方と、`expandBet` / `isHit` の置き場所 → [agent-design.md](agent-design.md)。
  **現状は仮に [lib/bets/](../lib/bets/) に置いてある**
- 取消・除外の返還ルールの詳細（`refund` に何を入れるか）。`isHit` は返還を扱わず、取消・除外の
  馬を含む買い目は不的中として返す
- **ゾロ目を含めるかどうかを列の中身だけからは決められない。** 枠連の展開で「ボックスのときは
  ゾロ目を作らない」を実装するのに `bet_style` を見ている。これは
  [decisions/0003](decisions/0003-bet-legs-as-columns.md) の「`bet_style` は計算に使わない」と
  食い違っている。整理が要る

マイグレーション運用と ORM は決着した →
[decisions/0004](decisions/0004-migrations-without-orm.md)。
