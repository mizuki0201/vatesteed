import { defineAgent } from "eve";

export default defineAgent({
  description:
    "1頭の馬について、血統から適性の素地を読んで pedigree_notes に残すときに使う。1回の呼び出しで1頭。まだ走ったことのない条件を先に決め、そこについてだけ、根拠の強さを分けて書く。血統が DB に無ければ自分で検索する。",
  model: "anthropic/claude-opus-5",
});
