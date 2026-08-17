import { defineAgent } from "eve";

export default defineAgent({
  description:
    "1頭の馬について、血統から適性の素地を読んで pedigree_notes に残すときに使う。1回の呼び出しで1頭。対象馬自身の実績は材料にせず、条件を絞らずに素地を書く。父母の産駒の傾向は progeny_notes 側で扱い、そこでは産駒の走った結果を見る。血統が DB に無ければ自分で検索する。",
  model: "anthropic/claude-opus-5",
});
