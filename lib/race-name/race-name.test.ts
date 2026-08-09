import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeRaceName } from "./race-name.ts";

describe("normalizeRaceName", () => {
  it("全角の括弧を半角にする", () => {
    assert.equal(normalizeRaceName("天皇賞（春）"), "天皇賞(春)");
  });

  it("全角の数字を半角にする", () => {
    assert.equal(normalizeRaceName("２歳ステークス"), "2歳ステークス");
  });

  it("全角の英字を半角にする", () => {
    assert.equal(normalizeRaceName("ＮＨＫマイルカップ"), "NHKマイルカップ");
  });

  it("空白を取り除く", () => {
    assert.equal(normalizeRaceName("天皇賞 （春）"), "天皇賞(春)");
    assert.equal(normalizeRaceName("　宝塚記念　"), "宝塚記念");
  });

  it("半角カナを全角にする。濁点も合成される", () => {
    assert.equal(normalizeRaceName("ﾎｰﾌﾟﾌﾙｽﾃｰｸｽ"), "ホープフルステークス");
    assert.equal(normalizeRaceName("ｼﾞｬﾊﾟﾝｶｯﾌﾟ"), "ジャパンカップ");
  });

  it("すでに正しい表記は変えない", () => {
    for (const name of [
      "天皇賞(春)",
      "有馬記念",
      "ジャパンカップ",
      "阪神ジュベナイルフィリーズ",
      "朝日杯フューチュリティステークス",
      "アメリカジョッキークラブカップ",
    ]) {
      assert.equal(normalizeRaceName(name), name);
    }
  });

  it("何度通しても結果が変わらない", () => {
    const once = normalizeRaceName("天皇賞 （春）");
    assert.equal(normalizeRaceName(once), once);
  });

  it("略称は展開しない。別名マスタの仕事", () => {
    assert.equal(normalizeRaceName("ホープフルS"), "ホープフルS");
  });
});
