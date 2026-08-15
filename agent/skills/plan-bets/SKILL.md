---
name: plan-bets
description: 予想から買い目を組み立てる。predict-race で印を付けたあとに使う。1レース2000円の予算で券種と点数を決め、ai_bets と ai_bet_legs に列の形で残す。
---

# 買い目を組む

**`predict-race` で印を付けてから使う。** 判断の根拠は
[docs/agent-design.md の予想の手順](../../../docs/agent-design.md#5-買い目を組む)。

## 予算は 2,000円で固定

**レースの格や自信度で変えない。** 恒久の設定。

自信のあるレースで増やすと、当たったときだけ張っていたのか見立てが良かったのかを分けられなく
なる。**予算を固定して初めて回収率を比べられる。**

券種と点数は自由。2,000円をどう割るかは予想の中身から決める。

## 列で表す

**すべての買い方を「列」だけで表す。** 列の数は券種が必要とする頭数と同じ（単勝1・馬連2・
3連複3）。`bet_style` は人間が読むためのラベルで、計算には使わない。

| 買い方 | 3連複での列の埋め方 |
| --- | --- |
| 単点 | 各列に1頭ずつ |
| フォーメーション | 列ごとに指定どおり |
| 軸1頭流し（軸=1、相手=2,3,4,5） | 列1={1}、**列2と列3の両方に {2,3,4,5}** |
| ボックス（1,2,3,4） | **3列すべてに {1,2,3,4}** |

列の中身は `entry_id`。**枠連のときだけ枠番**を入れる（`entry_id` は null）。

## 点数と金額は `lib/bets` で出す

**手で数えない。** `combination_count` と `total_amount` は導出値で、`expandBet` の
計算結果だけを入れる。

```ts
import { expandBet } from "@/lib/bets";

const r = expandBet({
  ticketType: "3連複",
  betStyle: "フォーメーション",
  isMulti: false,
  legs: [[7], [4, 8], [4, 8, 6, 10, 13, 16]], // entry_id
  unitAmount: 200,
});
// r.combinationCount / r.totalAmount を ai_bets に入れる
```

`unit_amount` は100円単位。`is_multi` を true にできるのは馬単と3連単だけ。

## 書き込む

1. `ai_bets` に1行（`race_id` / `ticket_type` / `bet_style` / `is_multi` / `unit_amount` /
   `combination_count` / `total_amount`）
2. `ai_bet_legs` に列ぶん（`ai_bet_id` / `leg_group` は何列目か / `entry_id`）

**展開した買い目そのものは保存しない。** 列さえあれば何度でも同じ結果が出る。

書き終えたら、**保存した列から `expandBet` で組み直して点数と金額が一致するか確かめる。**
ここがずれていると回収率がまるごと狂う。

## やらないこと

- **実際に馬券を買わない。** 記録だけ残して擬似的に購入し、回収率を計測する
- **予算を超えない・余らせない。** 2,000円に収める
- **`combination_count` と `total_amount` を手で入れない**
