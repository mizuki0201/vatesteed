import { defineAgent } from "eve";

export default defineAgent({
  description: "Vatesteed 自体の開発で、決まった docs と実装依頼に従ってコードと単体テストを書き、typecheck とテストを通すときに使う。競馬の分析には使わない。設計と docs は変えない。",
  model: "anthropic/claude-opus-5",
});
