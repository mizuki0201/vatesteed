import { defineAgent } from "eve";

export default defineAgent({
  description:
    "1人の騎手について、位置の取り方・仕掛けどころ・追い方の癖を読み解いて jockey_notes に残すときに使う。1回の呼び出しで1人。馬の力と騎手の腕を切り分けて見る。特定の馬との相性は horse_notes の担当なので書かない。",
  model: "anthropic/claude-opus-5",
});
