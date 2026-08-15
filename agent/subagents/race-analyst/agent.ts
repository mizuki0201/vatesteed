import { defineAgent } from "eve";

export default defineAgent({
  description:
    "終わったレースについて、ペース・隊列の動き・有利不利の傾向・レースのレベルを読み解いて race_notes に残すときに使う。1回の呼び出しで1レース。予想時点の展開の見立て（race_predictions）はこの役の担当ではない。",
  model: "anthropic/claude-opus-5",
});
