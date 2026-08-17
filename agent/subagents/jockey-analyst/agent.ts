import { defineAgent } from "eve";

export default defineAgent({
  description:
    "1人の騎手について、位置の取り方や追い方の癖を、材料のある範囲で読み解いて jockey_notes に残すときに使う。1回の呼び出しで1人。馬の力と騎手の腕を切り分け、通過順から意図までは読まない。特定の馬との相性は horse_notes の担当なので書かない。",
  model: "anthropic/claude-opus-5",
});
