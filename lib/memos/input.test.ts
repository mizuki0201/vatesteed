import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MEMO_BODY_MAX, normalizeMemoInput } from "./input.ts";

describe("normalizeMemoInput", () => {
  it("前後の空白を落とす", () => {
    const result = normalizeMemoInput("  もう1つ叩いてから、と陣営が言っていた  ", "  X  ");

    assert.deepEqual(result, {
      ok: true,
      body: "もう1つ叩いてから、と陣営が言っていた",
      source: "X",
    });
  });

  it("出典が無ければ null にする", () => {
    const result = normalizeMemoInput("見かけた話", "   ");

    assert.equal(result.ok && result.source, null);
  });

  it("空のメモは入れられない", () => {
    assert.deepEqual(normalizeMemoInput("   \n  ", null), { ok: false, reason: "empty" });
    assert.deepEqual(normalizeMemoInput(undefined, undefined), { ok: false, reason: "empty" });
  });

  it("上限ちょうどは通る", () => {
    const result = normalizeMemoInput("あ".repeat(MEMO_BODY_MAX), null);

    assert.equal(result.ok, true);
  });

  it("上限を超えたら断る", () => {
    const result = normalizeMemoInput("あ".repeat(MEMO_BODY_MAX + 1), null);

    assert.deepEqual(result, { ok: false, reason: "too-long" });
  });

  it("空白を落としたあとの長さで見る", () => {
    const body = `${"あ".repeat(MEMO_BODY_MAX)}\n\n`;

    assert.equal(normalizeMemoInput(body, null).ok, true);
  });

  it("サロゲートペアを2文字と数えない", () => {
    // DB 側の char_length() はコードポイントで数える。JS の .length と食い違うので合わせる
    const body = "𩸽".repeat(MEMO_BODY_MAX);

    assert.equal(body.length, MEMO_BODY_MAX * 2);
    assert.equal(normalizeMemoInput(body, null).ok, true);
  });
});
