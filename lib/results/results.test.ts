import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resultsPeriod } from "./period.ts";

describe("resultsPeriod", () => {
  it("開始日と終了日をそのまま使う", () => {
    assert.deepEqual(resultsPeriod({ from: "2026-01-01", to: "2026-12-31" }), {
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });

  it("存在しない日付と URL を壊す値は捨てる", () => {
    assert.deepEqual(resultsPeriod({ from: "2026-02-29", to: "not-a-date" }), {
      from: undefined,
      to: undefined,
    });
  });
});
