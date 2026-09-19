import { defineAgent } from "eve";

export default defineAgent({
  description:
    "分析と予想の結果を蓄積と突き合わせて「その読みは本当か」を突くときに使う。オーケストレーターが呼ぶ。予想では、展開・印・買い目のそれぞれを保存する前に1回ずつ呼ばれ、1回の呼び出しで1レースのその時点のものと根拠の評価を見る。評価は書かず、強さを付けた指摘を返す。",
  model: "anthropic/claude-opus-5",
});
