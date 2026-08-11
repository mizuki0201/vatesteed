import { defineAgent } from "eve";

export default defineAgent({
  description: "【未着手】ある出走で何が起きたか（展開・不利・相手関係・内容の質）を読み解くときに使う。中身がまだ書かれていないので、呼ばれても分析せず、未着手であることを返して止まる。",
  model: "anthropic/claude-sonnet-5",
});
