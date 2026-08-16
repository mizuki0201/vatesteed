import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatFinishTime, formatSeconds, formatWeightDiff } from "./format.ts";

describe("formatFinishTime", () => {
  it("分をまたぐ時計を m:ss.s にする", () => {
    assert.equal(formatFinishTime(118300), "1:58.3");
  });

  it("秒が1桁でも2桁に揃える", () => {
    assert.equal(formatFinishTime(65400), "1:05.4");
  });

  it("1分未満は分を出さない", () => {
    assert.equal(formatFinishTime(58300), "58.3");
  });

  it("ちょうどの分は 0.0 まで出す", () => {
    assert.equal(formatFinishTime(120000), "2:00.0");
  });

  it("10ミリ秒の桁は四捨五入する", () => {
    assert.equal(formatFinishTime(118350), "1:58.4");
  });

  it("無いものは空にする", () => {
    assert.equal(formatFinishTime(null), "");
    assert.equal(formatFinishTime(undefined), "");
  });
});

describe("formatSeconds", () => {
  it("上がり3Fを 34.7 の形にする", () => {
    assert.equal(formatSeconds(34700), "34.7");
  });

  it("60秒を超えても分に繰り上げない", () => {
    assert.equal(formatSeconds(72500), "72.5");
  });

  it("無いものは空にする", () => {
    assert.equal(formatSeconds(null), "");
  });
});

describe("formatWeightDiff", () => {
  it("増えたときは符号を付ける", () => {
    assert.equal(formatWeightDiff(8), "+8");
  });

  it("減ったときはそのまま", () => {
    assert.equal(formatWeightDiff(-4), "-4");
  });

  it("増減なしは 0", () => {
    assert.equal(formatWeightDiff(0), "0");
  });

  it("無いものは空にする", () => {
    assert.equal(formatWeightDiff(null), "");
  });
});
