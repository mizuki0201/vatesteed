import { defineAgent } from "eve";

export default defineAgent({
  description: "Vatesteed 自体の開発で、決まった指示のとおりにコードとドキュメントを書き、typecheck とテストを通すときに使う。競馬の分析には使わない。設計を自分で変えない。",
  model: "anthropic/claude-opus-5",
});
