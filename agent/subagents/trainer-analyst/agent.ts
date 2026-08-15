import { defineAgent } from "eve";

export default defineAgent({
  description:
    "1つの厩舎について、仕上げ方とローテーションの組み方を読み解いて trainer_notes に残すときに使う。1回の呼び出しで1つ。今回のレースが叩きかどうかを、過去の使い方から逆算する材料を出す。",
  model: "anthropic/claude-opus-5",
});
