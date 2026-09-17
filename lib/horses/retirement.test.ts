import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  nextRetirementTarget,
  parseRetirementInput,
  RETIREMENT_TARGET_LABELS,
  retiredOnLabel,
} from "./retirement.ts";

const TODAY = "2026-09-17";

describe("nextRetirementTarget", () => {
  it("引退日が無い馬は、引退に切り替える", () => {
    assert.equal(nextRetirementTarget(null), "retired");
    assert.equal(RETIREMENT_TARGET_LABELS[nextRetirementTarget(null)], "引退に変更");
  });

  it("引退日がある馬は、現役に切り替える", () => {
    assert.equal(nextRetirementTarget("2026-09-17"), "active");
    assert.equal(nextRetirementTarget("1900-01-01"), "active");
    assert.equal(RETIREMENT_TARGET_LABELS[nextRetirementTarget("2026-09-17")], "現役に変更");
  });
});

describe("retiredOnLabel", () => {
  it("日付が分からない馬は「日付不明」と出す", () => {
    assert.equal(retiredOnLabel("1900-01-01"), "日付不明");
  });

  it("それ以外は日付をそのまま出す", () => {
    assert.equal(retiredOnLabel("2021-07-10"), "2021-07-10");
  });
});

describe("parseRetirementInput", () => {
  it("引退日を入れれば、その日で引退にする", () => {
    assert.deepEqual(parseRetirementInput("12", "retired", "2021-07-10", TODAY), {
      ok: true,
      horseId: "12",
      target: "retired",
      retiredOn: "2021-07-10",
    });
  });

  it("引退日が空なら 1900-01-01 で引退にする", () => {
    for (const retiredOn of ["", "  ", null, undefined]) {
      assert.deepEqual(parseRetirementInput(" 7 ", "retired", retiredOn, TODAY), {
        ok: true,
        horseId: "7",
        target: "retired",
        retiredOn: "1900-01-01",
      });
    }
  });

  it("今日と 1900-01-01 ちょうどは通す", () => {
    assert.equal(parseRetirementInput("1", "retired", TODAY, TODAY).ok, true);
    assert.equal(parseRetirementInput("1", "retired", "1900-01-01", TODAY).ok, true);
  });

  it("実在しない日付・今日より後・1900-01-01 より前は弾く", () => {
    for (const retiredOn of ["2026-02-30", "2026-13-01", "2026/09/01", "20260901", "2026-09-18", "1899-12-31", 20260901]) {
      assert.deepEqual(
        parseRetirementInput("1", "retired", retiredOn, TODAY),
        { ok: false },
        `${String(retiredOn)} を通した`,
      );
    }
  });

  it("現役に戻すときは引退日を見ず、null にする", () => {
    assert.deepEqual(parseRetirementInput("3", "active", "2026-02-30", TODAY), {
      ok: true,
      horseId: "3",
      target: "active",
      retiredOn: null,
    });
  });

  it("ID が数字だけでなければ弾く", () => {
    for (const id of ["", "0", "01", "1a", "-1", "1 OR 1=1", null, undefined, 3]) {
      assert.deepEqual(parseRetirementInput(id, "retired", "", TODAY), { ok: false }, `${String(id)} を通した`);
    }
  });

  it("切り替え先が2つのどちらでもなければ弾く", () => {
    for (const target of ["", "all", "overseas", "Retired", null, undefined, true]) {
      assert.deepEqual(parseRetirementInput("1", target, "", TODAY), { ok: false }, `${String(target)} を通した`);
    }
  });
});
