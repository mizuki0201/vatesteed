import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ACCESS_LEVELS } from "../enums/index.ts";
import { can, listCapabilities, requiredLevel, REQUIRED_LEVEL } from "./policy.ts";

describe("can", () => {
  it("同じレベルなら見られる", () => {
    assert.equal(can("member", "races"), true);
  });

  it("上のレベルなら下のものも見られる", () => {
    assert.equal(can("owner", "races"), true);
    assert.equal(can("friend", "races"), true);
  });

  it("足りなければ見られない", () => {
    assert.equal(can("member", "horses"), false);
    assert.equal(can("friend", "notes.raw"), false);
    assert.equal(can("public", "races"), false);
  });

  it("public のものは誰でも見られる", () => {
    for (const level of ACCESS_LEVELS) {
      assert.equal(can(level, "about"), true, `${level} が about を見られない`);
      assert.equal(can(level, "tech"), true, `${level} が tech を見られない`);
    }
  });

  it("owner はすべて見られる", () => {
    for (const capability of Object.keys(REQUIRED_LEVEL) as (keyof typeof REQUIRED_LEVEL)[]) {
      assert.equal(can("owner", capability), true, `owner が ${capability} を見られない`);
    }
  });
});

describe("requiredLevel", () => {
  it("表に書いたレベルを返す", () => {
    assert.equal(requiredLevel("races"), "member");
    assert.equal(requiredLevel("results.mine"), "friend");
    assert.equal(requiredLevel("dashboard"), "owner");
  });
});

describe("listCapabilities", () => {
  it("表の全部を、強い順に返す", () => {
    const listed = listCapabilities();

    assert.equal(listed.length, Object.keys(REQUIRED_LEVEL).length);
    assert.equal(listed[0]?.level, "owner");
    assert.equal(listed.at(-1)?.level, "public");
  });
});
