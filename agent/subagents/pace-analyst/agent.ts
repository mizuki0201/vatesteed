import { defineAgent } from "eve";

export default defineAgent({
  description:
    "まだ走っていない1つのレースについて、基準のペース・前の集団の頭数・各時点の隊列を組み、主な想定とペースが逆に振れた想定、主な想定がどれだけ崩れにくいかを返すときに使う。1回の呼び出しで1レース。書き込まず、verifier の点検を通してからオーケストレーターが race_predictions に書く。終わったレースの評価は race-analyst の担当。",
  model: "anthropic/claude-opus-5",
});
