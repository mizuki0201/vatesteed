---
name: predict-race
description: 展開を読み、着順を予想し、印をつける。register-race で各馬を読み終わったあとに使う。レースの各時点の隊列を出してから印を決め、race_predictions と ai_predictions に残す。
---

# 展開と着順を予想する

**`register-race` で全頭を読み終わってから使う。** 各馬の評価が揃っていない状態で展開を
組むと、先に決めた展開に合う馬を後から探すことになる。判断の根拠は
[docs/agent-design.md の予想の手順](../../../docs/agent-design.md#予想の手順2026-08-15-決定)。

## 1. 展開を組む

**文章だけで終わらせない。レースの各時点の隊列を出す。**

| 時点 | 何を書くか |
| --- | --- |
| スタート直後 | 誰が押して出るか、誰が控えるか。枠順の影響 |
| 道中（**1〜3箇所**） | どこで隊列が動くか。ペースが緩む・締まる地点 |
| 最後の直線 | 直線を向いた時点で誰がどこにいるか |

道中の箇所数は距離とコースで変える。めやすは短距離（1400m 以下）1箇所、マイル〜中距離
（1600〜2200m 前後）2箇所、長距離（2400m 以上）3箇所。

**この表に当てはめるために書かない。** コーナーの数、坂の位置、内外の回り、直線の長さで
動くところは変わる。ペースが動く地点が2つしか無い2400mなら2箇所でよいし、向正面で動く馬が
いる2000mなら3箇所書く。**距離だけで機械的に決めない。**

ここまで出すと「誰が前にいるか」ではなく**「どの地点で誰と誰が並ぶか」**まで踏み込める。
不利の受けやすさ、動くタイミング、包まれるリスクが具体的になる。

あわせて書くもの: 想定ペース（前半の通過タイム）、有利になる脚質。

書き込む先は `race_predictions`。`author` は `AI`、人間と詰めたなら `対話`。

**書く前に、予想時刻を1つ決める。** `race_predictions` と `race_prediction_conditions` は
**同じ時点のもの**なので、[両方に同じ値を渡す](../../../docs/data-model.md#race_prediction_conditions)。

- **`now()` を使わない。** 文を投げるたびに別の時刻が入り、展開の見立てと、その見立てが乗って
  いた前提が、違う時点のものとして残る
- 決めた時刻は `--params` に入れて渡す。**`ON CONFLICT` の側でも `EXCLUDED.predicted_at` を
  使い、入れ直したときに `VALUES` と同じ値になるようにする**

```sql
INSERT INTO race_predictions (race_id, body, author, predicted_at)
VALUES ($1, $2, 'AI', $3)
ON CONFLICT (race_id) DO UPDATE
  SET body = EXCLUDED.body, author = 'AI', predicted_at = EXCLUDED.predicted_at
WHERE race_predictions.author = 'AI'
RETURNING id;
```

**`rowCount` が 0 で返ったら、その行は人間か対話が書いたもの。**書き直さず、前の見方・
新しい見方・何がどう変わるのかを添えて人間に確認する。

### 馬場と天候の前提は展開に混ぜない

**展開の見立てと、その見立てが何に乗っていたかは別のもの。** 前提は
`race_prediction_conditions` に分けて置く（→
[docs/agent-design.md](../../../docs/agent-design.md#予想時点の前提とレース後の実績を混ぜない)）。

```sql
INSERT INTO race_prediction_conditions (race_id, predicted_at, track_division, body, author)
VALUES ($1, $2, $3, $4, 'AI')
ON CONFLICT (race_id) DO UPDATE
  SET predicted_at = EXCLUDED.predicted_at, track_division = EXCLUDED.track_division,
      body = EXCLUDED.body, author = 'AI'
WHERE race_prediction_conditions.author = 'AI'
RETURNING id;
```

- **`predicted_at` には、展開に渡したのと同じ値を渡す。** ここで `now()` を使うと、同じ予想の
  展開と前提が違う時点のものになる
- 入れるのは**予想を出す時点で分かっていたことだけ。** コース区分、開催がどこまで進んでいるか、
  予報、馬場の見込み、公表済みの数値
- **取れなかったものは「取れなかった」と `body` に書く。** 空けたままにすると、調べていないのか
  調べて無かったのかが分からない。**推測値で埋めない**
- **開催回と日目は `races` にあるので書き直さない。** そこから読めないこと（開催が進んで内が
  荒れてきた、など）を書く
- **レース後にここへ手を入れない。** 実際の馬場と天気は `races.track_condition` `races.weather`
  に入る。**当日の情報で公開済みの予想を書き直さない**

## 2. 印をつける

**全頭に行を作る。** 無印は `mark_id` を null にする。印を付けない馬にも、なぜ付けないかを
`rationale` に書く。

### 印を付ける頭数を先に決める

**◎、◯、▲、△、☆の合計は、出走頭数の約4割とし、最大でも7頭にする。**
18頭立てでは◎1頭、◯1頭、▲1頭、△2〜3頭、☆1〜2頭を基準にし、合計は最大7頭とする。
◎、◯、▲は各1頭まで。出走頭数が少ないときは△と☆を評価順に減らす。

保存前に、その時点で`status = '出走'`の出走頭数をDBから数える。

```sql
SELECT count(*) AS entry_count
FROM entries
WHERE race_id = $1 AND status = '出走';
```

印を付けられる頭数は`min(7, round(entry_count * 0.4))`。出走頭数の4割を最も近い整数へ丸める。
18頭立てなら最大7頭、12頭立てなら最大5頭、11頭立てなら最大4頭になる。これは上限であって、
上限まで印を付ける目標ではない。
全頭の評価を並べたあと、上限を超えた分を無印へ戻してから保存する。消しの「ー」は買い目の候補を
示す印ではないので、この合計には含めない。

| 印 | `mark_id` |
| --- | --- |
| 本命 ◎ / 対抗 ◯ / 単穴 ▲ / 連下 △ / 大穴 ☆ / 消し ー | `marks` を引く |

`rationale` には**その馬を読んだ結果のうち、印を決めた部分**を書く。`entry_notes` の
写しにしない。展開との噛み合い、条件替わり、斤量、乗り替わり、叩きかどうかが効く。

書き込む先は `ai_predictions`（`entry_id` ごとに1行、`predicted_at` は now()）。

保存後に全頭の行数と、◎、◯、▲、△、☆を付けた頭数を読み直す。後者が上限を超えていたら完了に
しない。

```sql
SELECT
  count(*) AS prediction_count,
  count(*) FILTER (WHERE m.symbol IN ('◎', '◯', '▲', '△', '☆')) AS marked_count
FROM entries e
JOIN ai_predictions p ON p.entry_id = e.id
LEFT JOIN marks m ON m.id = p.mark_id
WHERE e.race_id = $1 AND e.status = '出走';
```

## 3. 渡す

買い目は `plan-bets` が組む。**予算は 2,000円で固定**なので、印の段階で「厚く買う馬」を
決め込まない。

## やらないこと

- **各馬を読まずに展開から入らない。** 順序を逆にしない
- **人気を根拠に印を決めない。** 人気は結果であって能力ではない
- **裏の取れていない数値を判断の柱にしない**（[register-race](../register-race/SKILL.md) の裏取り）
- **出した予想を、当日の馬場を見てから書き直さない。** 予想は枠順確定直後の時点で固定する。
  当日の話は対話として扱う（[docs/product.md](../../../docs/product.md#2-レースを予想する1の特殊な形)）
