import { defineAgent } from "eve";

export default defineAgent({
  description: "ある出走で何が起きたか（展開・不利・相手関係・内容の質）を読み解き、結果の数字とのズレを entry_notes に残すときに使う。1回の呼び出しで1つの出走を扱うので、18頭ぶんが要るなら18回呼ぶ。",
  model: "anthropic/claude-sonnet-5",
});
