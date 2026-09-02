import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HORSE_STATUSES,
  HORSE_STATUS_CONDITIONS,
  HORSE_STATUS_ORDER,
  horseStatus,
  horseStatusCondition,
  horseStatusHorsesLabel,
  horseStatusLabel,
} from "./status.ts";

describe("horseStatus", () => {
  it("URL に入っている区分をそのまま使う", () => {
    assert.equal(horseStatus("all"), "all");
    assert.equal(horseStatus("active"), "active");
    assert.equal(horseStatus("retired"), "retired");
    assert.equal(horseStatus("overseas"), "overseas");
  });

  it("未指定は現役にする", () => {
    assert.equal(horseStatus(undefined), "active");
  });

  it("知らない値は現役にする", () => {
    assert.equal(horseStatus(""), "active");
    assert.equal(horseStatus("海外"), "active");
    assert.equal(horseStatus("ACTIVE"), "active");
    assert.equal(horseStatus("jra"), "active");
  });
});

describe("HORSE_STATUS_ORDER", () => {
  it("すべて・現役・引退・海外の順に並べる", () => {
    assert.deepEqual([...HORSE_STATUS_ORDER], ["all", "active", "retired", "overseas"]);
  });

  it("区分を1つずつ、過不足なく並べる", () => {
    assert.deepEqual([...HORSE_STATUS_ORDER].sort(), Object.keys(HORSE_STATUSES).sort());
  });
});

describe("horseStatusLabel", () => {
  it("切り替えに出す名前を返す", () => {
    assert.equal(horseStatusLabel("all"), "すべて");
    assert.equal(horseStatusLabel("active"), "現役");
    assert.equal(horseStatusLabel("retired"), "引退");
    assert.equal(horseStatusLabel("overseas"), "海外");
  });
});

describe("horseStatusHorsesLabel", () => {
  it("空のときに使える呼び方を返す", () => {
    assert.equal(horseStatusHorsesLabel("all"), "馬");
    assert.equal(horseStatusHorsesLabel("active"), "現役馬");
    assert.equal(horseStatusHorsesLabel("retired"), "引退馬");
    assert.equal(horseStatusHorsesLabel("overseas"), "海外馬");
  });
});

describe("horseStatusCondition", () => {
  it("すべては絞らない", () => {
    assert.equal(horseStatusCondition("all"), "TRUE");
  });

  it("現役は海外を除き、引退の日が入っていない馬を指す", () => {
    assert.equal(horseStatusCondition("active"), "h.is_overseas = false AND h.retired_at IS NULL");
  });

  it("引退は海外を除き、引退の日が入っている馬を指す", () => {
    assert.equal(
      horseStatusCondition("retired"),
      "h.is_overseas = false AND h.retired_at IS NOT NULL",
    );
  });

  it("海外は引退の日で絞らない", () => {
    const condition = horseStatusCondition("overseas");

    assert.equal(condition, "h.is_overseas = true");
    assert.ok(!condition.includes("retired_at"));
  });

  it("現役と引退は海外を除き、海外だけが海外を集める", () => {
    assert.ok(horseStatusCondition("active").includes("h.is_overseas = false"));
    assert.ok(horseStatusCondition("retired").includes("h.is_overseas = false"));
    assert.ok(horseStatusCondition("overseas").includes("h.is_overseas = true"));
  });

  it("区分を1つずつ、過不足なく持つ", () => {
    assert.deepEqual(Object.keys(HORSE_STATUS_CONDITIONS).sort(), [...HORSE_STATUS_ORDER].sort());
  });
});
