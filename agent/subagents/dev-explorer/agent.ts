import { defineAgent } from "eve";

export default defineAgent({
  description: "Vatesteed 自体の開発で、リポジトリと docs の中の事実を集めるときに使う。競馬の分析には使わない。判断せず、見つけた事実とその所在だけを返す。",
  model: "anthropic/claude-sonnet-5",
});
