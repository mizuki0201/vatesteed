import { defineAgent } from "eve";

export default defineAgent({
  description:
    "予想するレースの出走馬について、過去の出走ごとの評価と血統を積み上げて「どういう馬か」を総合評価するときに使う。1回の呼び出しで1頭を扱うので、16頭ぶんが要るなら16回呼ぶ。レース後の振り返りでは呼ばない。horse_notes は対話で作ると決めているため、この役は書き込まず見立てを返す。",
  model: "anthropic/claude-opus-5",
});
