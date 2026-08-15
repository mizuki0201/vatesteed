import { defineAgent } from "eve";

export default defineAgent({
  description: "Vatesteed 自体の開発で、不具合の原因を突き止めるときに使う。競馬の分析には使わない。直さず、原因と再現の手順を返す。",
  model: "anthropic/claude-opus-5",
});
