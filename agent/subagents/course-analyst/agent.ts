import { defineAgent } from "eve";

export default defineAgent({
  description: "【未着手】あるコースの傾向を読むときに使う。中身がまだ書かれていないので、呼ばれても分析せず、未着手であることを返して止まる。",
  model: "anthropic/claude-sonnet-5",
});
