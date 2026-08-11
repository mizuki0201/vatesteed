import { defineAgent } from "eve";

export default defineAgent({
  description: "【未着手】1頭の馬について、これまでの走りを総合して評価するときに使う。中身がまだ書かれていないので、呼ばれても分析せず、未着手であることを返して止まる。",
  model: "anthropic/claude-sonnet-5",
});
