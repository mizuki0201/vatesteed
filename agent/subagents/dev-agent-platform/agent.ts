import { defineAgent } from "eve";

export default defineAgent({
  description: "Vatesteed 自体の開発で、eve と Claude Code の仕様を調べて答えを出すときに使う。競馬の分析には使わない。ファイルは書かず、根拠を添えた答えを返す。",
  model: "anthropic/claude-opus-5",
});
