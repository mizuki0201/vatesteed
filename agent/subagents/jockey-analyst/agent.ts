import { defineAgent } from "eve";

export default defineAgent({
  description: "【未着手】騎手の乗り方・仕掛けどころ・得手不得手を読むときに使う。中身がまだ書かれていないので、呼ばれても分析せず、未着手であることを返して止まる。",
  model: "anthropic/claude-sonnet-5",
});
