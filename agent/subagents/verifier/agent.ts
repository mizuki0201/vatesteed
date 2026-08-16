import { defineAgent } from "eve";

export default defineAgent({
  description:
    "分析と予想の結果を蓄積と突き合わせて「その読みは本当か」を突くときに使う。オーケストレーターが最終チェックとして呼ぶ。1回の呼び出しで1レースの予想一式（展開・印・買い目と根拠の評価）を見る。評価は書かず、強さを付けた指摘を返す。",
  model: "anthropic/claude-opus-5",
});
