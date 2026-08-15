import { defineAgent } from "eve";

export default defineAgent({
  description:
    "1頭の馬について、血統から適性の素地を読んで pedigree_notes に残すときに使う。1回の呼び出しで1頭。血統が DB に無く外部にも当たれないため、材料が渡されていなければ「材料が無い」と返して止まる。",
  model: "anthropic/claude-opus-5",
});
