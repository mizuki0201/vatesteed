import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  nextRetirementTarget,
  parseRetirementInput,
  RETIREMENT_TARGET_LABELS,
} from "./retirement.ts";

describe("nextRetirementTarget", () => {
  it("引退日が無い馬は、引退に切り替える", () => {
    assert.equal(nextRetirementTarget(null), "retired");
    assert.equal(RETIREMENT_TARGET_LABELS[nextRetirementTarget(null)], "引退に変更");
  });

  it("引退日がある馬は、現役に切り替える", () => {
    assert.equal(nextRetirementTarget("2026-09-17"), "active");
    assert.equal(RETIREMENT_TARGET_LABELS[nextRetirementTarget("2026-09-17")], "現役に変更");
  });
});

describe("parseRetirementInput", () => {
  it("数字の ID と、2つのどちらかの切り替え先なら通す", () => {
    assert.deepEqual(parseRetirementInput("12", "retired"), {
      ok: true,
      horseId: "12",
      target: "retired",
    });
    assert.deepEqual(parseRetirementInput(" 7 ", "active"), {
      ok: true,
      horseId: "7",
      target: "active",
    });
  });

  it("ID が数字だけでなければ弾く", () => {
    for (const id of ["", "0", "01", "1a", "-1", "1 OR 1=1", null, undefined, 3]) {
      assert.deepEqual(parseRetirementInput(id, "retired"), { ok: false }, `${String(id)} を通した`);
    }
  });

  it("切り替え先が2つのどちらでもなければ弾く", () => {
    for (const target of ["", "all", "overseas", "Retired", null, undefined, true]) {
      assert.deepEqual(parseRetirementInput("1", target), { ok: false }, `${String(target)} を通した`);
    }
  });
});
