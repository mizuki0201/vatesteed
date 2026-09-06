import assert from "node:assert/strict";
import { test } from "node:test";
import { canReadLocalReviewRuns } from "./dashboard.ts";

test("ローカルではレビュー記録を読める", () => {
  assert.equal(canReadLocalReviewRuns({}), true);
});

test("Vercelではローカルのレビュー記録を読まない", () => {
  assert.equal(canReadLocalReviewRuns({ VERCEL: "1" }), false);
});
