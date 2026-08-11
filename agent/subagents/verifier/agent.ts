import { defineAgent } from "eve";

export default defineAgent({
  description: "【未着手】分析の結果を蓄積と突き合わせて検証するときに使う。オーケストレーターが最終チェックとして呼ぶ。中身がまだ書かれていないので、呼ばれても検証せず、未着手であることを返して止まる。",
  model: "anthropic/claude-sonnet-5",
});
