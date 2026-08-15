import { defineAgent } from "eve";

export default defineAgent({
  description:
    "1つのコース（競馬場・芝ダート・距離・内外）について、枠順や脚質の向き・仕掛けどころを読み解いて course_notes に残すときに使う。1回の呼び出しで1つ。その日の馬場の話は race_notes の担当なので混ぜない。",
  model: "anthropic/claude-opus-5",
});
