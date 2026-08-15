import { defineAgent } from "eve";

export default defineAgent({
  description: "Vatesteed 自体の開発で、書かれたものを指示・docs・コンセプト・言葉づかいと突き合わせるときに使う。競馬の分析には使わない。直さず、指摘だけを返す。",
  model: "anthropic/claude-opus-5",
});
